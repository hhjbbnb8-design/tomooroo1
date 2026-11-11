import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AssignmentFormDialog } from "@/components/AssignmentFormDialog";
import { EmptyState, PageHeader, StatusPill } from "@/components/PageParts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, initials } from "@/lib/format";
import { trpc } from "@/lib/trpc";

type SubmissionRow = {
  id: number;
  studentId: number;
  studentName: string;
  studentUsername: string;
  content: string | null;
  fileName: string | null;
  fileUrl: string | null;
  grade: number | null;
  feedback: string | null;
  submittedAt: Date;
  gradedAt: Date | null;
};

function GradeDialog({
  submission,
  maxGrade,
  onClose,
}: {
  submission: SubmissionRow | null;
  maxGrade: number;
  onClose: () => void;
}) {
  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const utils = trpc.useUtils();

  useEffect(() => {
    if (submission) {
      setGrade(submission.grade === null ? "" : String(submission.grade));
      setFeedback(submission.feedback ?? "");
    }
  }, [submission]);

  const mutation = trpc.teacher.submissions.grade.useMutation({
    onSuccess: async () => {
      toast.success("Grade and feedback saved");
      await Promise.all([
        utils.teacher.assignments.get.invalidate(),
        utils.teacher.assignments.list.invalidate(),
        utils.teacher.overview.invalidate(),
      ]);
      onClose();
    },
    onError: error => toast.error(error.message),
  });

  const open = Boolean(submission);
  const handleOpenChange = (value: boolean) => {
    if (!value) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg" dir="ltr">
        <DialogHeader>
          <DialogTitle className="font-display">Grade assignment for {submission?.studentName}</DialogTitle>
          <DialogDescription>
            Review the submission, then add a grade out of {maxGrade} and feedback for the student.
          </DialogDescription>
        </DialogHeader>
        {submission && (
          <div className="space-y-4">
            <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-background/60 p-3 text-sm leading-6 text-muted-foreground scrollbar-thin">
              {submission.content || "No text attached."}
            </div>
            {submission.fileUrl && (
              <a
                href={submission.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10"
              >
                <Paperclip className="h-3.5 w-3.5" />
                {submission.fileName ?? "Attached file"}
              </a>
            )}
            <div className="space-y-2">
              <Label htmlFor="grade">grade (from {maxGrade})</Label>
              <Input
                id="grade"
                type="number"
                min={0}
                max={maxGrade}
                value={grade}
                onChange={event => setGrade(event.target.value)}
                className="bg-background/60"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback">Feedback for the student (optional)</Label>
              <Textarea
                id="feedback"
                value={feedback}
                onChange={event => setFeedback(event.target.value)}
                placeholder="What did you like about the solution, and what could be improved?"
                className="min-h-20 bg-background/60"
              />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending}
            onClick={() => {
              if (!submission) return;
              const value = Number(grade);
              if (!Number.isFinite(value) || value < 0 || value > maxGrade) {
                return toast.error(`grade between 0 and${maxGrade}`);
              }
              mutation.mutate({
                submissionId: submission.id,
                grade: value,
                feedback: feedback.trim() || null,
              });
            }}
          >
            {mutation.isPending ? "Saving..." : "Save grade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TeacherAssignmentDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const [, setLocation] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [gradeTarget, setGradeTarget] = useState<SubmissionRow | null>(null);
  const utils = trpc.useUtils();

  const assignmentQuery = trpc.teacher.assignments.get.useQuery(
    { id },
    { enabled: Number.isInteger(id) && id > 0 }
  );
  const data = assignmentQuery.data;

  const deleteMutation = trpc.teacher.assignments.delete.useMutation({
    onSuccess: async () => {
      toast.success("Assignment deleted");
      await utils.teacher.assignments.list.invalidate();
      await utils.teacher.overview.invalidate();
      setLocation("/teacher/assignments");
    },
    onError: error => toast.error(error.message),
  });

  if (assignmentQuery.isLoading) {
    return (
      <AppShell title="assignment">
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          In progress Loading assignment...
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell title="assignment">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <h2 className="font-display text-lg font-semibold">Assignment not found</h2>
          <Button className="mt-5" asChild>
            <Link href="/teacher/assignments">Back to assignments</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const { assignment, submissions, notSubmitted } = data;
  const gradedCount = submissions.filter(item => item.grade !== null).length;
  const closed = new Date(assignment.dueAt).getTime() < Date.now();

  return (
    <AppShell title={assignment.title}>
      <Link
        href="/teacher/assignments"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-ink"
      >
        <ArrowRight className="h-4 w-4" />
        All assignments
      </Link>

      <PageHeader
        eyebrow={`Last deadline: ${formatDateTime(assignment.dueAt)} · Grade out of ${assignment.maxGrade}`}
        title={assignment.title}
        description={assignment.description ?? undefined}
        actions={
          <>
            <StatusPill status={closed ? "ended" : "scheduled"} label={closed ? "Submission closed" : "Open for submissions"} />
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="ml-1 h-4 w-4" />
              Edit
            </Button>
            <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="ml-1 h-4 w-4" />
              Delete
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="border-border/80 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Submissions ({submissions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {submissions.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No one has submitted yet"
                description="Each submission with its content and file will appear here. You can grade submissions after they arrive."
                className="border-0 bg-transparent py-10"
              />
            ) : (
              <div className="divide-y divide-border/70">
                {submissions.map(submission => (
                  <div key={submission.id} className="py-4 first:pt-1 last:pb-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                          {initials(submission.studentName)}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-ink">{submission.studentName}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Submit {formatDateTime(submission.submittedAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {submission.grade !== null ? (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            {submission.grade} / {assignment.maxGrade}
                          </span>
                        ) : (
                          <StatusPill status="submitted" label="Awaiting grading" />
                        )}
                        <Button size="sm" variant="outline" onClick={() => setGradeTarget(submission)}>
                          {submission.grade !== null ? "Edit grade" : "Grade"}
                        </Button>
                      </div>
                    </div>
                    {submission.content && (
                      <p className="mt-2 line-clamp-3 whitespace-pre-line rounded-xl bg-background/50 px-3 py-2 text-xs leading-6 text-muted-foreground">
                        {submission.content}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                      {submission.fileUrl && (
                        <a
                          href={submission.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-primary hover:underline"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {submission.fileName ?? "Attached file"}
                        </a>
                      )}
                      {submission.feedback && (
                        <span className="text-muted-foreground">Your feedback: {submission.feedback}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base">Submission summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Received</span>
                <strong className="text-ink">{submissions.length}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Graded</span>
                <strong className="text-ink">{gradedCount}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Not submitted</span>
                <strong className="text-ink">{notSubmitted.length}</strong>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{
                    width: `${
                      submissions.length ? Math.round((gradedCount / submissions.length) * 100) : 0
                    }%`,
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <Users className="h-4 w-4 text-muted-foreground" />
                Not submitted yet
              </CardTitle>
            </CardHeader>
            <CardContent>
              {notSubmitted.length === 0 ? (
                <p className="text-xs text-muted-foreground">All students have submitted the assignment.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {notSubmitted.map(student => (
                    <span
                      key={student.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground"
                    >
                      <UserRound className="h-3 w-3" />
                      {student.name}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AssignmentFormDialog open={editOpen} onOpenChange={setEditOpen} assignment={assignment} />
      <GradeDialog
        submission={gradeTarget}
        maxGrade={assignment.maxGrade}
        onClose={() => setGradeTarget(null)}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent dir="ltr">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              The assignment, all submissions, and grades will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteMutation.mutate({ id })}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete assignment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
