import { useMemo, useState } from "react";
import { CalendarPlus, Loader2, Video } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LessonCard } from "@/components/LessonCard";
import { LessonFormDialog } from "@/components/LessonFormDialog";
import { EmptyState, PageHeader } from "@/components/PageParts";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type Filter = "all" | "scheduled" | "live" | "ended";

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "scheduled", label: "upcoming" },
  { value: "live", label: "live" },
  { value: "ended", label: "Ended" },
];

export default function TeacherLessons() {
  const [filter, setFilter] = useState<Filter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const lessonsQuery = trpc.teacher.lessons.list.useQuery();
  const lessons = lessonsQuery.data ?? [];

  const counts = useMemo(
    () => ({
      all: lessons.length,
      scheduled: lessons.filter(lesson => lesson.status === "scheduled").length,
      live: lessons.filter(lesson => lesson.status === "live").length,
      ended: lessons.filter(lesson => lesson.status === "ended").length,
    }),
    [lessons]
  );

  const filtered = filter === "all" ? lessons : lessons.filter(lesson => lesson.status === filter);

  return (
    <AppShell title="Live lessons">
      <PageHeader
        eyebrow="Administration Lessons"
        title="My lessons"
        description="Create lessons, set their times, and start streaming from the lesson page. Every lesson is recorded automatically and saved afterward."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <CalendarPlus className="ml-1 h-4 w-4" />
            New lesson
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map(item => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-colors",
              filter === item.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-ink"
            )}
          >
            {item.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px]",
                filter === item.value ? "bg-white/15" : "bg-secondary"
              )}
            >
              {counts[item.value]}
            </span>
          </button>
        ))}
      </div>

      {lessonsQuery.isLoading ? (
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          Loading lessons...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Video}
          title={lessons.length === 0 ? "No lessons created yet" : "No lessons in this category"}
          description={
            lessons.length === 0
              ? "Create your first lesson and set its time; it will appear for you and your students."
              : "Try another filter or create a new lesson."
          }
          action={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <CalendarPlus className="ml-1 h-4 w-4" />
              Create lesson
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map(lesson => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              href={`/teacher/lessons/${lesson.id}`}
              liveHref={`/live/${lesson.id}`}
            />
          ))}
        </div>
      )}

      <LessonFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </AppShell>
  );
}
