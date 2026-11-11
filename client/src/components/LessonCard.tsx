import { Link } from "wouter";
import { ArrowLeft, Clock3, MonitorPlay, UserRound, Video } from "lucide-react";
import { formatShortDate, formatTime, formatDuration } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { StatusPill } from "./PageParts";
import { cn } from "@/lib/utils";

export type LessonCardData = {
  id: number;
  title: string;
  description?: string | null;
  scheduledAt: Date | string;
  durationMinutes: number;
  status: "scheduled" | "live" | "ended";
  teacherName?: string | null;
  recording?: { status: string; url?: string } | null;
};

export function LessonCard({
  lesson,
  href,
  liveHref,
  className,
}: {
  lesson: LessonCardData;
  href: string;
  liveHref?: string;
  className?: string;
}) {
  const date = new Date(lesson.scheduledAt);
  const day = new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
    day: "numeric",
    timeZone: "Asia/Riyadh",
  }).format(date);
  const weekday = new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
    weekday: "short",
    timeZone: "Asia/Riyadh",
  }).format(date);

  return (
    <div
      className={cn(
        "group relative flex overflow-hidden rounded-2xl border border-border/80 bg-card card-lift",
        className
      )}
    >
      <div className="flex w-[74px] shrink-0 flex-col items-center justify-center border-l border-dashed border-border bg-secondary/40 px-2 py-5 text-center">
        <span className="text-[11px] font-medium text-muted-foreground">{weekday}</span>
        <span className="font-display text-2xl font-bold leading-tight text-ink">{day}</span>
        <span className="mt-1 text-[11px] text-muted-foreground">{formatTime(date)}</span>
      </div>

      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={lesson.status} />
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            {lesson.durationMinutes} min
          </span>
          {lesson.recording?.status === "ready" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              <MonitorPlay className="h-3.5 w-3.5" />
              Recording ready
            </span>
          )}
        </div>

        <h3 className="mt-2 truncate font-display text-base font-semibold text-ink sm:text-lg">
          {lesson.title}
        </h3>
        {lesson.description && (
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {lesson.description}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {lesson.teacherName && (
              <span className="inline-flex items-center gap-1">
                <UserRound className="h-3.5 w-3.5" />
                {lesson.teacherName}
              </span>
            )}
            <span>{formatShortDate(date)}</span>
          </div>
          <div className="flex items-center gap-2">
            {lesson.status === "live" && liveHref && (
              <Button asChild size="sm" className="bg-red-600 text-white hover:bg-red-700">
                <Link href={liveHref}>
                  <Video className="ml-1 h-4 w-4" />
                  Join now
                </Link>
              </Button>
            )}
            <Button asChild size="sm" variant="outline">
              <Link href={href}>
                Details
                <ArrowLeft className="mr-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RecordingPlayer({
  url,
  title,
  durationSec,
}: {
  url: string;
  title: string;
  durationSec?: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-black">
      <video
        className="aspect-video w-full"
        src={url}
        controls
        preload="metadata"
        playsInline
      >
        <track kind="captions" />
      </video>
      <div className="flex flex-wrap items-center justify-between gap-2 bg-card px-4 py-3 text-sm">
        <span className="font-medium text-ink">{title}</span>
        <span className="text-xs text-muted-foreground">
          {durationSec ? formatDuration(durationSec) : "Lesson recording"}
        </span>
      </div>
    </div>
  );
}
