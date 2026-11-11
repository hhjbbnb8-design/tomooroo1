import { useMemo, useState } from "react";
import {
  GraduationCap,
  KeyRound,
  Loader2,
  Plus,
  School,
  Search,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { EmptyState, PageHeader, StatCard } from "@/components/PageParts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, formatRelative, initials } from "@/lib/format";
import { trpc } from "@/lib/trpc";

type StudentRow = {
  id: number;
  name: string;
  username: string;
  schoolId: number | null;
  schoolName: string;
  isActive: boolean;
  createdAt: Date;
  lastSignedIn: Date | null;
};

function AddStudentForm({ schools }: { schools: { id: number; name: string }[] }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [schoolId, setSchoolId] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);

  const createStudent = trpc.admin.createStudent.useMutation({
    onSuccess: async () => {
      toast.success(`Created account for ${name} successfully`);
      setName("");
      setUsername("");
      setPassword("");
      setSchoolId("");
      await Promise.all([
        utils.admin.listStudents.invalidate(),
        utils.admin.overview.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) return toast.error("Enter the student’s full name");
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username.trim())) {
      return toast.error("Username: 3–32 English letters or numbers only");
    }
    if (password.length < 6) return toast.error("Password 6 characters at least least");
    if (!schoolId) return toast.error("Select the student’s school");
    createStudent.mutate({
      name: name.trim(),
      username: username.trim(),
      password,
      schoolId: Number(schoolId),
    });
  };

  return (
    <Card className="border-border/80 bg-card shadow-[0_16px_40px_-32px_rgba(21,33,59,0.5)]">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Plus className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="font-display text-base">Add new student</CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              The administrator creates student accounts only
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="student-name">Student name</Label>
            <Input
              id="student-name"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Example: Nora Al Salem"
              className="bg-background/60"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="student-username">Username</Label>
            <Input
              id="student-username"
              value={username}
              onChange={event => setUsername(event.target.value)}
              placeholder="noura.s"
              className="bg-background/60"
              dir="ltr"
            />
            <p className="text-[11px] text-muted-foreground">
              English letters, numbers, and periods only; no spaces.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="student-password">Password</Label>
              <button
                type="button"
                onClick={() => setShowPassword(value => !value)}
                className="text-[11px] text-primary hover:underline"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <Input
              id="student-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="6 characters at least least"
              className="bg-background/60"
              dir="ltr"
            />
          </div>
          <div className="space-y-2">
            <Label>School</Label>
            <Select value={schoolId} onValueChange={setSchoolId}>
              <SelectTrigger className="w-full bg-background/60">
                <SelectValue placeholder="Select the student’s school" />
              </SelectTrigger>
              <SelectContent>
                {schools.map(school => (
                  <SelectItem key={school.id} value={String(school.id)}>
                    {school.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={createStudent.isPending}>
            {createStudent.isPending ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                <Plus className="ml-1 h-4 w-4" />
                Create student account
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ResetPasswordDialog({
  student,
  onClose,
}: {
  student: StudentRow | null;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();
  const mutation = trpc.admin.resetStudentPassword.useMutation({
    onSuccess: async () => {
      toast.success(`Done Update word password ${student?.name}`);
      setPassword("");
      await utils.admin.listStudents.invalidate();
      onClose();
    },
    onError: error => toast.error(error.message),
  });

  return (
    <Dialog open={Boolean(student)} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md" dir="ltr">
        <DialogHeader>
          <DialogTitle className="font-display">Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for <strong>{student?.name}</strong> (Username:{" "}
            <span dir="ltr">{student?.username}</span>).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reset-password">New password</Label>
          <Input
            id="reset-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            dir="ltr"
            placeholder="6 characters at least least"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending}
            onClick={() => {
              if (password.length < 6) return toast.error("Password 6 characters at least least");
              if (student) mutation.mutate({ studentId: student.id, password });
            }}
          >
            {mutation.isPending ? "Saving..." : "Save password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const overviewQuery = trpc.admin.overview.useQuery();
  const studentsQuery = trpc.admin.listStudents.useQuery(undefined);
  const teachersQuery = trpc.admin.listTeachers.useQuery();
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [resetTarget, setResetTarget] = useState<StudentRow | null>(null);

  const toggleActive = trpc.admin.setStudentActive.useMutation({
    onSuccess: async (_data, variables) => {
      toast.success(variables.isActive ? "Account activated" : "Account disabled");
      await Promise.all([utils.admin.listStudents.invalidate(), utils.admin.overview.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });

  const schools = overviewQuery.data?.schoolList ?? [];
  const students = studentsQuery.data ?? [];
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return students.filter(student => {
      const matchesSchool = schoolFilter === "all" || String(student.schoolId) === schoolFilter;
      const matchesSearch =
        !query ||
        student.name.toLowerCase().includes(query) ||
        student.username.toLowerCase().includes(query);
      return matchesSchool && matchesSearch;
    });
  }, [students, search, schoolFilter]);

  return (
    <AppShell title="Admin dashboard">
      <PageHeader
        eyebrow="Platform administration"
        title={
          <>
            Good morning, {user?.name.split(" ")[0] ?? "Teacher"}
            <span className="text-amber">.</span>
          </>
        }
        description="Manage Tomorrow School student accounts: create accounts, set passwords, and disable accounts from here."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Total students" value={overviewQuery.data?.students ?? "—"} hint="Across both schools" />
        <StatCard
          icon={ShieldCheck}
          label="Active students"
          value={overviewQuery.data?.activeStudents ?? "—"}
          tone="green"
          hint="Active accounts"
          className="stagger-1"
        />
        <StatCard
          icon={UserRound}
          label="teachers"
          value={overviewQuery.data?.teachers ?? "—"}
          tone="amber"
          hint="Fixed accounts"
          className="stagger-2"
        />
        <StatCard
          icon={School}
          label="schools"
          value={overviewQuery.data?.schools ?? "—"}
          hint="Only school"
          className="stagger-3"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
        <AddStudentForm schools={schools} />

        <Card className="border-border/80 bg-card">
          <CardHeader className="gap-4 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="font-display text-base">Platform students</CardTitle>
                <CardDescription className="mt-0.5 text-xs">
                  {filtered.length} of {students.length} students
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Search by name or username"
                    className="h-9 w-52 bg-background/60 pr-9 text-sm"
                  />
                </div>
                <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                  <SelectTrigger className="h-9 w-40 bg-background/60 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All schools</SelectItem>
                    {schools.map(school => (
                      <SelectItem key={school.id} value={String(school.id)}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {studentsQuery.isLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                Loading students...
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title={students.length === 0 ? "No students yet" : "No results"}
                description={
                  students.length === 0
                    ? "Start by adding the first student using the “Add new student” form."
                    : "Try changing your search or choosing another school."
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-right text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="pb-3 font-medium">student</th>
                      <th className="pb-3 font-medium">School</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Last sign-in</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(student => (
                      <tr
                        key={student.id}
                        className="border-b border-border/60 last:border-0 hover:bg-secondary/30"
                      >
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                              {initials(student.name)}
                            </span>
                            <div>
                              <div className="font-medium text-ink">{student.name}</div>
                              <div className="text-[11px] text-muted-foreground" dir="ltr">
                                @{student.username}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className="inline-flex rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                            {student.schoolName}
                          </span>
                        </td>
                        <td className="py-3">
                          <span
                            className={
                              student.isActive
                                ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700"
                                : "inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700"
                            }
                          >
                            <span
                              className={
                                student.isActive
                                  ? "h-1.5 w-1.5 rounded-full bg-emerald-500"
                                  : "h-1.5 w-1.5 rounded-full bg-red-500"
                              }
                            />
                            {student.isActive ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td className="py-3 text-xs text-muted-foreground">
                          {student.lastSignedIn ? formatRelative(student.lastSignedIn) : "Has not signed in"}
                          <div className="text-[10px] text-muted-foreground/70">
                            Created {formatDate(student.createdAt)}
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-primary"
                              onClick={() => setResetTarget(student)}
                            >
                              <KeyRound className="ml-1 h-3.5 w-3.5" />
                              Password
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={
                                student.isActive
                                  ? "h-8 px-2 text-xs text-red-600 hover:text-red-700"
                                  : "h-8 px-2 text-xs text-emerald-600 hover:text-emerald-700"
                              }
                              disabled={toggleActive.isPending}
                              onClick={() =>
                                toggleActive.mutate({
                                  studentId: student.id,
                                  isActive: !student.isActive,
                                })
                              }
                            >
                              {student.isActive ? (
                                <ToggleLeft className="ml-1 h-4 w-4" />
                              ) : (
                                <ToggleRight className="ml-1 h-4 w-4" />
                              )}
                              {student.isActive ? "Disable" : "Activate"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-border/80 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">Teaching team</CardTitle>
          <CardDescription className="text-xs">
            Teacher accounts are managed by platform settings; each teacher sees only their own school.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(teachersQuery.data ?? []).map(teacher => (
              <div
                key={teacher.id}
                className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/50 p-3"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber/15 text-xs font-bold text-[#8a5a10]">
                  {initials(teacher.name)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">{teacher.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {teacher.schoolName} · <span dir="ltr">@{teacher.username}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ResetPasswordDialog student={resetTarget} onClose={() => setResetTarget(null)} />
    </AppShell>
  );
}
