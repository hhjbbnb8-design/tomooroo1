import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, GraduationCap, Loader2, LockKeyhole, MonitorPlay, UserRound, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo, LogoMark } from "@/components/Logo";
import { FullScreenLoader } from "@/components/RequireRole";
import { useAuth } from "@/hooks/useAuth";
import { storeToken } from "@/lib/session";
import { homeForRole } from "@/lib/routes";
import { trpc } from "@/lib/trpc";

const demoAccounts = [
  { label: "Tomorrow School teacher", username: "teacher", password: "Teacher@1234", icon: UserRound },
  { label: "Tomorrow School student", username: "student", password: "Student@1234", icon: GraduationCap },
];

const features = [
  { icon: Video, label: "Live lesson streaming" },
  { icon: MonitorPlay, label: "Screen sharing and automatic recording" },
  { icon: GraduationCap, label: "Assignments and grading" },
];

export default function Login() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = trpc.auth.login.useMutation({
    onSuccess: data => {
      storeToken(data.token);
      utils.auth.me.setData(undefined, data.user);
      setLocation(homeForRole(data.user.role));
    },
    onError: err => setError(err.message),
  });

  useEffect(() => {
    if (!loading && user) setLocation(homeForRole(user.role));
  }, [user, loading, setLocation]);

  if (loading) return <FullScreenLoader label="Checking your session..." />;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("Enter your username and password");
      return;
    }
    login.mutate({ username: username.trim(), password });
  };

  const fillDemo = (account: (typeof demoAccounts)[number]) => {
    setUsername(account.username);
    setPassword(account.password);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      {/* Brand panel */}
      <section className="relative overflow-hidden bg-sidebar px-6 py-10 text-white sm:px-10 lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <div className="grid-pattern pointer-events-none absolute inset-0 opacity-60" />
        <div
          className="pointer-events-none absolute -left-24 top-1/3 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #E8A33D 0%, transparent 65%)" }}
        />
        <svg
          viewBox="0 0 200 260"
          className="pointer-events-none absolute -left-10 bottom-0 h-[420px] w-[320px] text-white/[0.05]"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M100 10 190 140c0 60-40 100-90 140-50-40-90-80-90-140L100 10Z"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path d="M100 70v150" stroke="currentColor" strokeWidth="2" />
          <circle cx="100" cy="160" r="16" stroke="currentColor" strokeWidth="2" />
        </svg>

        <div className="relative z-10 flex items-center justify-between">
          <Logo variant="dark" />
          <span className="hidden rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/60 sm:inline">
            Schools edition
          </span>
        </div>

        <div className="relative z-10 mt-12 max-w-xl lg:mt-0">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber/30 bg-amber/10 px-3 py-1.5 text-[11px] font-medium text-amber">
            <span className="live-dot" />
            Live lessons, attendance, and learning
          </div>
          <h1 className="font-display text-4xl font-bold leading-[1.25] sm:text-5xl">
            Your lesson starts here,
            <br />
            <span className="relative inline-block text-amber">
              and the recording stays afterward.
              <span className="absolute inset-x-0 -bottom-2 h-1.5 rounded-full bg-amber/50" />
            </span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-8 text-white/65 sm:text-base">
            Midad for <strong className="text-white">Tomorrow School</strong>:
            One place: teachers stream lessons and share their screens,
            while the system saves recordings automatically and students submit assignments and receive grades.
          </p>

          <div className="mt-8 flex flex-wrap gap-2.5">
            {features.map(feature => (
              <span
                key={feature.label}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white/75"
              >
                <feature.icon className="h-4 w-4 text-amber" />
                {feature.label}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-12 flex flex-wrap items-center gap-3 text-[11px] text-white/40 lg:mt-0">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber" />
            Tomorrow School
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber" />
          </span>
          <span className="mr-auto hidden sm:inline">© {new Date().getFullYear()} Midad</span>
        </div>
      </section>

      {/* Sign-in form */}
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md animate-rise">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark className="h-10 w-10" />
            <div>
              <div className="font-display text-xl font-bold text-ink">Midad</div>
              <div className="text-[11px] text-muted-foreground">Tomorrow School</div>
            </div>
          </div>

          <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">
            Sign-in portal
          </div>
          <h2 className="font-display text-3xl font-bold text-ink">Welcome back</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Sign in with the username and password provided by your platform administrator.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  value={username}
                  onChange={event => setUsername(event.target.value)}
                  placeholder="Example: student"
                  autoComplete="username"
                  className="h-12 bg-card pr-10"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="h-12 bg-card pl-11 pr-10"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:bg-secondary"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="h-12 w-full rounded-xl text-base"
              disabled={login.isPending}
            >
              {login.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="mt-8 rounded-2xl border border-border bg-card/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">Demo accounts</span>
              <span className="text-[11px] text-muted-foreground">Click to fill</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {demoAccounts.map(account => (
                <button
                  key={account.username}
                  type="button"
                  onClick={() => fillDemo(account)}
                  className="flex flex-col items-start gap-1 rounded-xl border border-border bg-background/60 px-3 py-2.5 text-right transition-colors hover:border-primary/30 hover:bg-primary/5"
                >
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink">
                    <account.icon className="h-3.5 w-3.5 text-primary" />
                    {account.label}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground" dir="ltr">
                    {account.username}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
              Demo access is available for teacher and student accounts. Administrator access is private and is not
              displayed on this page.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
