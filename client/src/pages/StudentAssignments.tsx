import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, BookOpenCheck, Clock3, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState, PageHeader, StatusPill } from "@/components/PageParts";
import { formatDateTime, formatRelative } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type Filter = "all" | "pending" | "submitted" | "graded" | "missed";

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Due" },
  { value: "submitted", label: "Submitted" },
  { value: "graded", label: "Graded" },
  { value: "missed", label: "Missed" },
];

export default function StudentAssignments() {
  const [filter, setFilter] = useState<Filter>("all");
  const assignmentsQuery = trpc.student.assignments.list.useQuery();
  const assignments = assignmentsQuery.data ?? [];

  const counts = useMemo(() => {
    const result: Record<Filter, number> = {
      all: assignments.length,
      pending: 0,
      submitted: 0,
      graded: 0,
      missed: 0,
    };
    assignments.forEach(item => {
      result[item.status as Filter] += 1;
    });
    return result;
  }, [assignments]);

  const filtered =
    filter === "all" ? assignments : assignments.filter(assignment => assignment.status === filter);

  return (
    <AppShell title="Assignments">
      <PageHeader
        eyebrow="Your school’s assignments"
        title="My assignments"
        description="Review required assignments, submit your answer as text or a file, and track your teacher’s grade and feedback."
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

      {assignmentsQuery.isLoading ? (
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          In progress Loading Assignments...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpenCheck}
          title={assignments.length === 0 ? "No assignments yet" : "No assignments in this filter"}
          description="When your teacher publishes an assignment, it will appear here with its submission deadline."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(assignment => (
            <Link
              key={assignment.id}
              href={`/student/assignments/${assignment.id}`}
              className="group flex items-center gap-4 rounded-2xl border border-border/80 bg-card p-4 card-lift sm:p-5"
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                  assignment.status === "graded"
                    ? "bg-emerald-50 text-emerald-700"
                    : assignment.status === "missed"
                      ? "bg-red-50 text-red-600"
                      : assignment.status === "submitted"
                        ? "bg-sky-50 text-sky-700"
                        : "bg-amber/15 text-[#8a5a10]"
                )}
              >
                <BookOpenCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="line-clamp-1 text-sm font-semibold text-ink sm:text-base">
                    {assignment.title}
                  </h3>
                  <StatusPill status={assignment.status} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{assignment.teacherName}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatDateTime(assignment.dueAt)}
                  </span>
                  <span
                    className={
                      assignment.status === "pending" ? "font-medium text-[#8a5a10]" : ""
                    }
                  >
                    {formatRelative(assignment.dueAt)}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {assignment.grade !== null && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {assignment.grade}/{assignment.maxGrade}
                  </span>
                )}
                <ArrowLeft className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
