import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  BookOpenCheck,
  CalendarClock,
  ClipboardList,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorPlay,
  School,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { homeForRole, roleLabel, type Role } from "@/lib/routes";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };

const NAV: Record<Role, NavItem[]> = {
  admin: [
    { href: "/admin", label: "Admin dashboard", icon: LayoutDashboard, exact: true },
  ],
  teacher: [
    { href: "/teacher", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/teacher/lessons", label: "Live lessons", icon: Video },
    { href: "/teacher/assignments", label: "Assignments", icon: ClipboardList },
    { href: "/teacher/recordings", label: "Recording library", icon: MonitorPlay },
  ],
  student: [
    { href: "/student", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/student/lessons", label: "Lessons", icon: CalendarClock },
    { href: "/student/assignments", label: "Assignments", icon: BookOpenCheck },
    { href: "/student/grades", label: "My grades", icon: GraduationCap },
  ],
};

function isActive(location: string, item: NavItem) {
  if (item.exact) return location === item.href;
  return location === item.href || location.startsWith(`${item.href}/`);
}

function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const mutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onOpenChange(false);
    },
    onError: error => toast.error(error.message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 6) {
      toast.error("The new password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    mutation.mutate({ currentPassword, newPassword });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="ltr">
        <DialogHeader>
          <DialogTitle className="font-display">Change password</DialogTitle>
          <DialogDescription>Choose a new password for your account.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={event => setNewPassword(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              required
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [passwordOpen, setPasswordOpen] = useState(false);
  if (!user) return null;
  const role = user.role as Role;
  const items = NAV[role];

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border/70 px-5 py-6">
        <Link href={homeForRole(role)} onClick={onNavigate}>
          <Logo variant="dark" />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-5">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wide text-white/35">
          Main menu
        </div>
        {items.map(item => {
          const active = isActive(location, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-white/10 text-white shadow-[inset_3px_0_0_0_var(--amber)]"
                  : "text-white/65 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon
                className={cn(
                  "h-[18px] w-[18px] transition-colors",
                  active ? "text-amber" : "text-white/45 group-hover:text-white/80"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <div className="flex items-center gap-2 text-xs text-white/55">
          <School className="h-4 w-4 text-amber" />
          <span className="truncate">{user.schoolName ?? "Platform administration"}</span>
        </div>
        <div className="mt-1 text-[11px] text-white/35">
          {role === "admin" ? "Tomorrow School" : "Midad learning platform"}
        </div>
      </div>

      <div className="border-t border-sidebar-border/70 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber/15 font-display text-sm font-bold text-amber">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{user.name}</div>
            <div className="text-[11px] text-white/45">{roleLabel[role]}</div>
          </div>
          <button
            type="button"
            onClick={() => setPasswordOpen(true)}
            title="Change password"
            className="rounded-lg p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
          >
            <KeyRound className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            title="Sign out"
            className="rounded-lg p-2 text-white/45 transition-colors hover:bg-red-500/15 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}

export function AppShell({
  title,
  description,
  eyebrow,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const today = new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-64 lg:block">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 w-[86%] max-w-xs animate-fade shadow-2xl">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute left-3 top-4 rounded-lg bg-white/10 p-2 text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="lg:mr-64">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-xl border border-border bg-card p-2 text-ink lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2 text-sm">
                <span className="hidden font-display font-semibold text-ink sm:inline">Midad</span>
                <span className="hidden text-border sm:inline">/</span>
                <span className="text-muted-foreground">{title ?? "Dashboard"}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:inline">
                {today}
              </span>
              {user?.schoolName && (
                <span className="rounded-full border border-amber/30 bg-amber/10 px-3 py-1.5 text-xs font-medium text-[#8a5a10]">
                  {user.schoolName}
                </span>
              )}
            </div>
          </div>
        </header>

        <main className="paper-bg min-h-[calc(100vh-4rem)]">
          <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8">
            {(title || actions) && (
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  {eyebrow && (
                    <div className="mb-1 text-xs font-semibold text-muted-foreground">{eyebrow}</div>
                  )}
                  {title && <h1 className="font-display text-xl font-bold text-ink">{title}</h1>}
                  {description && (
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                  )}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
