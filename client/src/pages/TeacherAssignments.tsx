import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarPlus, ClipboardList, Loader2, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AssignmentFormDialog } from "@/components/AssignmentFormDialog";
import { EmptyState, PageHeader, StatusPill } from "@/components/PageParts";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatRelative } from "@/lib/format";
import { trpc } from "@/lib/trpc";

export default function TeacherAssignments() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const assignmentsQuery = trpc.teacher.assignments.list.useQuery();
  const assignments = assignmentsQuery.data ?? [];

  return (
    <AppShell title="Assignments">
      <PageHeader
        eyebrow="grading andTracking"
        title="My assignments"
        description="Publish assignments for your students, track submissions, then add grades and feedback for each student."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="ml-1 h-4 w-4" />
            New assignment
          </Button>
        }
      />

      {assignmentsQuery.isLoading ? (
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          In progress Loading Assignments...
        </div>
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assignments yet"
          description="Create your first assignment and set its submission deadline and maximum grade."
          action={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <CalendarPlus className="ml-1 h-4 w-4" />
              Create assignment
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {assignments.map(assignment => {
            const closed = new Date(assignment.dueAt).getTime() < Date.now();
            const percent =
              assignment.submissionCount > 0
                ? Math.round((assignment.gradedCount / assignment.submissionCount) * 100)
                : 0;
            return (
              <Link
                key={assignment.id}
                href={`/teacher/assignments/${assignment.id}`}
                className="group block rounded-2xl border border-border/80 bg-card p-5 card-lift"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill
                        status={closed ? "ended" : "scheduled"}
                        label={closed ? "Submission closed" : "Open"}
                      />
                      <span className="text-[11px] text-muted-foreground">
                        Grade out of {assignment.maxGrade}
                      </span>
                    </div>
                    <h3 className="mt-2 line-clamp-1 font-display text-base font-semibold text-ink">
                      {assignment.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-6 text-muted-foreground">
                      {assignment.description || "No additional instructions"}
                    </p>
                  </div>
                  <ArrowLeft className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1" />
                </div>

                <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Last deadline: {formatDateTime(assignment.dueAt)}</span>
                  <span>{formatRelative(assignment.dueAt)}</span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {assignment.gradedCount}/{assignment.submissionCount} graded
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-dashed border-border pt-3 text-xs">
                  <span className="text-muted-foreground">
                    <strong className="font-semibold text-ink">{assignment.submissionCount}</strong>{" "}
                    Submission received
                  </span>
                  <span className="font-medium text-primary">Open assignment and grade submissions</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <AssignmentFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </AppShell>
  );
}
