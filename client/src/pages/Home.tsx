import { ArrowRight, BookOpenCheck, MonitorPlay, Video } from "lucide-react";
import { Link } from "wouter";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Video, title: "Live lessons", description: "Join scheduled classes with your teacher." },
  { icon: MonitorPlay, title: "Automatic recordings", description: "Review every completed lesson whenever you need." },
  { icon: BookOpenCheck, title: "Assignments and grading", description: "Submit your work and follow your feedback." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background" dir="ltr">
      <section className="relative overflow-hidden bg-sidebar px-6 py-10 text-white sm:px-10 lg:px-16 lg:py-14">
        <div className="grid-pattern pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-6xl">
          <Logo variant="dark" />
          <div className="max-w-2xl py-20 sm:py-28">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber/30 bg-amber/10 px-3 py-1.5 text-xs font-medium text-amber">
              <span className="live-dot" />
              Tomorrow School learning platform
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight sm:text-6xl">
              Learn live. Review later. Keep moving forward.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-white/65 sm:text-lg">
              Midad brings live teaching, screen sharing, saved lesson recordings, assignments, and
              grading together for Tomorrow School.
            </p>
            <Button asChild size="lg" className="mt-8 bg-amber text-ink hover:bg-amber/90">
              <Link href="/login">
                Sign in to Tomorrow School
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 py-12 sm:grid-cols-3 sm:px-10 lg:px-16">
        {features.map(feature => (
          <div key={feature.title} className="rounded-2xl border border-border bg-card p-5">
            <feature.icon className="h-5 w-5 text-primary" />
            <h2 className="mt-4 font-display text-base font-semibold text-ink">{feature.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
