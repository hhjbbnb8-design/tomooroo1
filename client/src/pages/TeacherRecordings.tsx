import { useState } from "react";
import { Link } from "wouter";
import { Clock3, Loader2, MonitorPlay, Play, Video } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RecordingPlayer } from "@/components/LessonCard";
import { EmptyState, PageHeader } from "@/components/PageParts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatBytes, formatDuration } from "@/lib/format";
import { trpc } from "@/lib/trpc";

type RecordingRow = {
  id: number;
  lessonId: number;
  title: string;
  scheduledAt: Date;
  durationSec: number;
  sizeBytes: number;
  url: string;
};

export default function TeacherRecordings() {
  const recordingsQuery = trpc.teacher.recordings.list.useQuery();
  const [active, setActive] = useState<RecordingRow | null>(null);
  const recordings = recordingsQuery.data ?? [];

  return (
    <AppShell title="Recording library">
      <PageHeader
        eyebrow="recordings"
        title="My lesson recordings"
        description="Every lesson you stream is recorded automatically and saved here. Review it or share its link with students from the lesson page."
      />

      {recordingsQuery.isLoading ? (
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          Loading recordings...
        </div>
      ) : recordings.length === 0 ? (
        <EmptyState
          icon={MonitorPlay}
          title="No recordings ready yet"
          description="Start a live lesson and the stream recording will appear here automatically after the lesson ends."
          action={
            <Button size="sm" asChild>
              <Link href="/teacher/lessons">
                <Video className="ml-1 h-4 w-4" />
                Go to lessons
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {recordings.map(recording => (
            <div
              key={recording.id}
              className="group overflow-hidden rounded-2xl border border-border/80 bg-card card-lift"
            >
              <button
                type="button"
                onClick={() => setActive(recording)}
                className="relative flex aspect-video w-full items-center justify-center bg-sidebar"
                aria-label={`Play ${recording.title}`}
              >
                <div className="grid-pattern absolute inset-0 opacity-40" />
                <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-amber text-ink shadow-lg transition-transform group-hover:scale-105">
                  <Play className="mr-0.5 h-6 w-6 fill-ink" />
                </span>
                <span className="absolute bottom-3 left-3 rounded-md bg-black/50 px-2 py-1 text-[11px] text-white">
                  {formatDuration(recording.durationSec)}
                </span>
              </button>
              <div className="p-4">
                <h3 className="line-clamp-1 font-display text-sm font-semibold text-ink">
                  {recording.title}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatDate(recording.scheduledAt)}
                  </span>
                  <span>{formatBytes(recording.sizeBytes)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-dashed border-border pt-3">
                  <Link
                    href={`/teacher/lessons/${recording.lessonId}`}
                    className="text-[11px] text-muted-foreground hover:text-primary hover:underline"
                  >
                    Lesson page
                  </Link>
                  <Button size="sm" variant="outline" onClick={() => setActive(recording)}>
                    <Play className="ml-1 h-3.5 w-3.5" />
                    Watch
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={Boolean(active)} onOpenChange={open => !open && setActive(null)}>
        <DialogContent className="sm:max-w-3xl" dir="ltr">
          <DialogHeader>
            <DialogTitle className="font-display">{active?.title}</DialogTitle>
          </DialogHeader>
          {active && (
            <RecordingPlayer
              url={active.url}
              title={active.title}
              durationSec={active.durationSec}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
