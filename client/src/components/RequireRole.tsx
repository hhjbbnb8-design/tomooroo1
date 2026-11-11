import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { homeForRole, type Role } from "@/lib/routes";
import { LogoMark } from "./Logo";

export function FullScreenLoader({ label = "Preparing your dashboard..." }: { label?: string }) {
  return (
    <div className="paper-bg flex min-h-screen flex-col items-center justify-center gap-5">
      <LogoMark className="h-14 w-14" />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </div>
    </div>
  );
}

export function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setLocation("/login");
      return;
    }
    if (!roles.includes(user.role as Role)) {
      setLocation(homeForRole(user.role as Role));
    }
  }, [user, loading, roles, setLocation]);

  if (loading) return <FullScreenLoader />;
  if (!user || !roles.includes(user.role as Role)) return null;
  return <>{children}</>;
}
