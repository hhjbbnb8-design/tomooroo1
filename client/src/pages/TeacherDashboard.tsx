import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarPlus,
  ClipboardList,
  GraduationCap,
  Loader2,
  MonitorPlay,
  Plus,
  Radio,
  Users,
  Video,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LessonCard } from "@/components/LessonCard";
import { LessonFormDialog } from "@/components/LessonFormDialog";
import { WeeklySchedule } from "@/components/WeeklySchedule";
import { EmptyState, PageHeader, StatCard, StatusPill } from "@/components/PageParts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { formatRelative } from "@/lib/format";
import { trpc } from "@/lib/trpc";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const overviewQuery = trpc.teacher.overview.useQuery();
  const overview = overviewQuery.data;

  return (
    <AppShell title="Overview">
      <PageHeader
        eyebrow="Teacher dashboard"
        title={
          <>
            Hello, {user?.name ?? "Teacher"}
            <span className="text-amber">.</span>
          </>
        }
        description="Your lessons, assignments, and student recordings in one place. Start a lesson with one click and the explanation will be recorded automatically."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/teacher/assignments">
                <ClipboardList className="ml-1 h-4 w-4" />
                Assignments
              </Link>
            </Button>
            <Button onClick={() => setLessonDialogOpen(true)}>
              <CalendarPlus className="ml-1 h-4 w-4" />
              New lesson
            </Button>
          </>
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
                      The stream is open and your students can join. Automatic recording is active.
                    </p>
                  </div>
                </div>
                <Button asChild className="bg-amber text-ink hover:bg-amber/90">
                  <Link href={`/live/${overview.liveLesson.id}`}>
                    <Video className="ml-1 h-4 w-4" />
                    Return to stream
                  </Link>
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard icon={Users} label="My school’s students" value={overview?.studentsCount ?? "—"} hint={overview?.schoolName ?? ""} />
            <StatCard
              icon={Video}
              label="Upcoming lessons"
              value={overview?.upcomingCount ?? "—"}
              tone="amber"
              hint="Waiting to start"
              className="stagger-1"
            />
            <StatCard
              icon={ClipboardList}
              label="Submissions to grade"
              value={overview?.pendingGrading ?? "—"}
              tone="red"
              hint="Not graded yet"
              className="stagger-2"
            />
            <StatCard
              icon={MonitorPlay}
              label="Ready recordings"
              value={overview?.recordingsReady ?? "—"}
              tone="green"
              hint="Saved for students"
              className="stagger-3"
            />
          </div>

          <WeeklySchedule />

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.25fr_1fr]">
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-ink">Upcoming lessons</h2>
                <Link
                  href="/teacher/lessons"
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
                    description="Create a lesson and set its time; your students will see it immediately."
                    action={
                      <Button size="sm" onClick={() => setLessonDialogOpen(true)}>
                        <Plus className="ml-1 h-4 w-4" />
                        Create lesson
                      </Button>
                    }
                  />
                ) : (
                  overview?.upcoming.map(lesson => (
                    <LessonCard
                      key={lesson.id}
                      lesson={lesson}
                      href={`/teacher/lessons/${lesson.id}`}
                      liveHref={`/live/${lesson.id}`}
                    />
                  ))
                )}
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-ink">Assignment tracking</h2>
                <Link
                  href="/teacher/assignments"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  All assignments
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Link>
              </div>
              <Card className="border-border/80 bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 font-display text-sm">
                    <BookOpenCheck className="h-4 w-4 text-primary" />
                    Latest assignments
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-2">
                  {(overview?.recentAssignments ?? []).length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      You have not published any assignments yet.
                      <div className="mt-3">
                        <Button variant="outline" size="sm" asChild>
                          <Link href="/teacher/assignments">Create assignment</Link>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    overview?.recentAssignments.map(assignment => {
                      const total = Math.max(assignment.submissionCount, 1);
                      const percent = Math.round((assignment.gradedCount / total) * 100);
                      return (
                        <Link
                          key={assignment.id}
                          href={`/teacher/assignments/${assignment.id}`}
                          className="block rounded-xl border border-border/70 bg-background/50 p-3 transition-colors hover:border-primary/25 hover:bg-primary/[0.03]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="line-clamp-1 text-sm font-medium text-ink">
                              {assignment.title}
                            </span>
                            {assignment.overdue ? (
                              <StatusPill status="ended" label="Past due" />
                            ) : (
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {formatRelative(assignment.dueAt)}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>
                              {assignment.submissionCount} Submit · {assignment.gradedCount} graded
                            </span>
                            <span>{percent}%</span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </Link>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card className="mt-4 border-amber/25 bg-amber/[0.06]">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber/20 text-[#8a5a10]">
                      <GraduationCap className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-ink">Before-lesson reminder</h3>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">
                        When the stream starts, allow camera and microphone access, then share your screen from the controls. Recording starts automatically and is saved when the lesson ends.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>
        </>
      )}

      <LessonFormDialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen} />
    </AppShell>
  );
}
