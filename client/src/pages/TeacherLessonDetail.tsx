import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Loader2,
  MonitorPlay,
  Pencil,
  Radio,
  School,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { LessonFormDialog } from "@/components/LessonFormDialog";
import { PageHeader, StatusPill } from "@/components/PageParts";
import { RecordingPlayer } from "@/components/LessonCard";
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
import { formatDateTime, formatDuration } from "@/lib/format";
import { trpc } from "@/lib/trpc";

export default function TeacherLessonDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const [, setLocation] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const utils = trpc.useUtils();

  const lessonQuery = trpc.teacher.lessons.get.useQuery(
    { id },
    { enabled: Number.isInteger(id) && id > 0, refetchInterval: 8000 }
  );
  const lesson = lessonQuery.data;

  const deleteMutation = trpc.teacher.lessons.delete.useMutation({
    onSuccess: async () => {
      toast.success("Lesson deleted");
      await utils.teacher.lessons.list.invalidate();
      await utils.teacher.overview.invalidate();
      setLocation("/teacher/lessons");
    },
    onError: error => toast.error(error.message),
  });

  if (lessonQuery.isLoading) {
    return (
      <AppShell title="lesson">
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          In progress Loading lesson...
        </div>
      </AppShell>
    );
  }

  if (!lesson) {
    return (
      <AppShell title="lesson">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <h2 className="font-display text-lg font-semibold">Lesson not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">It may have been deleted or you may not have permission to view it.</p>
          <Button className="mt-5" asChild>
            <Link href="/teacher/lessons">Back to lessons</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const recording = lesson.recording;
  const isLive = lesson.status === "live";
  const isScheduled = lesson.status === "scheduled";

  return (
    <AppShell title={lesson.title}>
      <Link
        href="/teacher/lessons"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-ink"
      >
        <ArrowRight className="h-4 w-4" />
        All lessons
      </Link>

      <PageHeader
        eyebrow={`${lesson.schoolName ?? "School"} · ${formatDateTime(lesson.scheduledAt)}`}
        title={lesson.title}
        description={lesson.description ?? undefined}
        actions={
          <>
            <StatusPill status={lesson.status} />
            {isScheduled && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="ml-1 h-4 w-4" />
                Edit
              </Button>
            )}
            {!isLive && (
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="ml-1 h-4 w-4" />
                Delete
              </Button>
            )}
            {(isScheduled || isLive) && (
              <Button asChild className={isLive ? "bg-red-600 hover:bg-red-700" : ""}>
                <Link href={`/live/${lesson.id}`}>
                  {isLive ? <Radio className="ml-1 h-4 w-4" /> : <Video className="ml-1 h-4 w-4" />}
                  {isLive ? "Join stream" : "Start lesson"}
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          {isLive && (
            <Card className="overflow-hidden border-red-200 bg-red-50/60">
              <CardContent className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="live-dot mt-2" />
                  <div>
                    <div className="font-display text-base font-semibold text-ink">
                      The lesson is live now
                    </div>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">
                      Automatic recording is active. Do not close the page before clicking “End lesson” to save the recording.
                    </p>
                  </div>
                </div>
                <Button asChild className="bg-red-600 hover:bg-red-700">
                  <Link href={`/live/${lesson.id}`}>Enter stream</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {isScheduled && (
            <Card className="overflow-hidden border-0 bg-sidebar text-white">
              <div className="grid-pattern absolute inset-0 opacity-40" />
              <CardContent className="relative p-6">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-amber">
                  <Radio className="h-4 w-4" />
                  Before starting the stream
                </div>
                <h2 className="mt-2 font-display text-xl font-semibold">Everything ready to begin?</h2>
                <p className="mt-2 max-w-xl text-sm leading-7 text-white/60">
                  Camera and microphone access will be requested. After starting, you can share your screen from the controls; the explanation is recorded automatically and saved when the lesson ends.
                </p>
                <div className="mt-5 grid gap-2 text-xs text-white/70 sm:grid-cols-3">
                  <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    1. Allow camera and microphone access
                  </span>
                  <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    2. Share your screen for the explanation
                  </span>
                  <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    3. End the lesson to save the recording
                  </span>
                </div>
                <Button asChild className="mt-5 bg-amber text-ink hover:bg-amber/90">
                  <Link href={`/live/${lesson.id}`}>
                    <Video className="ml-1 h-4 w-4" />
                    Start live lesson
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <MonitorPlay className="h-4 w-4 text-primary" />
                Lesson recording
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recording?.status === "ready" && recording.url ? (
                <RecordingPlayer url={recording.url} title={lesson.title} />
              ) : recording?.status === "processing" || recording?.status === "recording" ? (
                <div className="flex items-center gap-3 rounded-xl border border-amber/25 bg-amber/[0.07] p-4 text-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-[#8a5a10]" />
                  <div>
                    <div className="font-medium text-ink">Preparing recording</div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      The recording will appear here automatically after the lesson ends and is saved.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-background/50 p-5 text-sm text-muted-foreground">
                  {isLive
                    ? "Recording starts automatically when the stream begins."
                    : "No recording is saved for this lesson. Upcoming lessons are recorded automatically when they begin."}
                </div>
              )}
            </CardContent>
          </Card>

          {lesson.description && (
            <Card className="border-border/80 bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">About the lesson</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">
                  {lesson.description}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base">Lesson details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">scheduled time</div>
                  <div className="mt-0.5 font-medium text-ink">{formatDateTime(lesson.scheduledAt)}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Duration</div>
                  <div className="mt-0.5 font-medium text-ink">{lesson.durationMinutes} min</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <School className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">School</div>
                  <div className="mt-0.5 font-medium text-ink">{lesson.schoolName ?? "—"}</div>
                </div>
              </div>
              {recording?.status === "ready" && (
                <div className="flex items-start gap-3">
                  <MonitorPlay className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Recording duration</div>
                    <div className="mt-0.5 font-medium text-ink">
                      {formatDuration(recording.durationSec)}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card">
            <CardContent className="p-5 text-xs leading-6 text-muted-foreground">
              <strong className="text-ink">Note:</strong> recording captures the teacher’s audio and the screen or camera shown in the stream. Make sure to choose the correct screen when sharing.
            </CardContent>
          </Card>
        </div>
      </div>

      <LessonFormDialog open={editOpen} onOpenChange={setEditOpen} lesson={lesson} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent dir="ltr">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete lesson?</AlertDialogTitle>
            <AlertDialogDescription>
              The lesson history and recording will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteMutation.mutate({ id })}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete lesson"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
