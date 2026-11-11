import { Link } from "wouter";
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarClock,
  GraduationCap,
  Loader2,
  Radio,
  Sparkles,
  Video,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LessonCard } from "@/components/LessonCard";
import { EmptyState, PageHeader, StatCard, StatusPill } from "@/components/PageParts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime, formatRelative } from "@/lib/format";
import { trpc } from "@/lib/trpc";

export default function StudentDashboard() {
  const { user } = useAuth();
  const overviewQuery = trpc.student.overview.useQuery();
  const gradesQuery = trpc.student.submissions.mine.useQuery();
  const overview = overviewQuery.data;
  const recentGrades = (gradesQuery.data ?? []).filter(item => item.grade !== null).slice(0, 4);

  return (
    <AppShell title="Overview">
      <PageHeader
        eyebrow="Student dashboard"
        title={
          <>
            Hello, {user?.name.split(" ")[0] ?? "student"}
            <span className="text-amber">.</span>
          </>
        }
        description="Your upcoming lessons, assignments, and grades are here. Join live lessons and watch recordings afterward."
        actions={
          <Button variant="outline" asChild>
            <Link href="/student/assignments">
              <BookOpenCheck className="ml-1 h-4 w-4" />
              My assignments
            </Link>
          </Button>
        }
      />

      {overviewQuery.isLoading ? (
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          Loading your dashboard...
        </div>
      ) : (
        <>
          {overview?.liveLesson && (
            <div className="animate-rise relative mb-6 overflow-hidden rounded-2xl bg-sidebar p-5 text-white sm:p-6">
              <div className="grid-pattern pointer-events-none absolute inset-0 opacity-50" />
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/15">
                    <Radio className="h-6 w-6 text-red-400" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-red-300">
                      <span className="live-dot" />
                      Live lesson now
                    </div>
                    <h3 className="mt-1 font-display text-lg font-semibold">
                      {overview.liveLesson.title}
                    </h3>
                    <p className="mt-1 text-xs text-white/55">
                      with {overview.liveLesson.teacherName} · join before the lesson ends
                    </p>
                  </div>
                </div>
                <Button asChild className="bg-red-600 text-white hover:bg-red-700">
                  <Link href={`/live/${overview.liveLesson.id}`}>
                    <Video className="ml-1 h-4 w-4" />
                    Join now
                  </Link>
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              icon={BookOpenCheck}
              label="Due assignments"
              value={overview?.pendingCount ?? "—"}
              tone="amber"
              hint="Waiting for your submission"
            />
            <StatCard
              icon={CalendarClock}
              label="Upcoming lessons"
              value={overview?.upcoming.length ?? "—"}
              hint={overview?.schoolName ?? ""}
              className="stagger-1"
            />
            <StatCard
              icon={Sparkles}
              label="Your average grade"
              value={overview?.average !== null && overview?.average !== undefined ? `${overview.average}%` : "—"}
              tone="green"
              hint="From graded assignments"
              className="stagger-2"
            />
            <StatCard
              icon={GraduationCap}
              label="Graded assignments"
              value={overview?.gradedCount ?? "—"}
              hint="Grade received"
              className="stagger-3"
            />
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.25fr_1fr]">
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-ink">Upcoming lessons</h2>
                <Link
                  href="/student/lessons"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  All lessons
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="space-y-3">
                {(overview?.upcoming ?? []).length === 0 ? (
                  <EmptyState
                    icon={Video}
                    title="No upcoming lessons"
                    description="Everything your teacher schedules appears here, with the live lesson at the top when it starts."
                  />
                ) : (
                  overview?.upcoming.map(lesson => (
                    <LessonCard
                      key={lesson.id}
                      lesson={lesson}
                      href={`/student/lessons/${lesson.id}`}
                      liveHref={`/live/${lesson.id}`}
                    />
                  ))
                )}
              </div>
            </section>

            <section className="space-y-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-ink">Assignments needing your attention</h2>
                <Link
                  href="/student/assignments"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  All assignments
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Link>
              </div>

              <Card className="border-border/80 bg-card">
                <CardContent className="space-y-3 p-4">
                  {(overview?.pending ?? []).length === 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      No assignments are due right now. Well done!
                    </div>
                  ) : (
                    overview?.pending.map(assignment => (
                      <Link
                        key={assignment.id}
                        href={`/student/assignments/${assignment.id}`}
                        className="block rounded-xl border border-border/70 bg-background/50 p-3 transition-colors hover:border-primary/25 hover:bg-primary/[0.03]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="line-clamp-1 text-sm font-medium text-ink">
                            {assignment.title}
                          </span>
                          <StatusPill status="pending" />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{assignment.teacherName}</span>
                          <span className="font-medium text-[#8a5a10]">
                            submission {formatRelative(assignment.dueAt)}
                          </span>
                        </div>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/80 bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 font-display text-sm">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    Latest grades
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-1">
                  {recentGrades.length === 0 ? (
                    <p className="py-2 text-xs text-muted-foreground">No assignments have been graded yet.</p>
                  ) : (
                    recentGrades.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg px-1 py-1.5 text-xs"
                      >
                        <span className="line-clamp-1 text-ink">{item.assignmentTitle}</span>
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                          {item.grade}/{item.maxGrade}
                        </span>
                      </div>
                    ))
                  )}
                  <Link
                    href="/student/grades"
                    className="mt-1 block border-t border-dashed border-border pt-2 text-[11px] text-primary hover:underline"
                  >
                    All grades
                  </Link>
                </CardContent>
              </Card>
            </section>
          </div>
        </>
      )}
    </AppShell>
  );
}
