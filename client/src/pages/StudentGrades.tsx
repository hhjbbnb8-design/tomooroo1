import { Link } from "wouter";
import { GraduationCap, Loader2, MessageSquareText, Paperclip } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState, PageHeader, StatCard } from "@/components/PageParts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { trpc } from "@/lib/trpc";

export default function StudentGrades() {
  const gradesQuery = trpc.student.submissions.mine.useQuery();
  const grades = gradesQuery.data ?? [];
  const graded = grades.filter(item => item.grade !== null);
  const average =
    graded.length > 0
      ? Math.round(
          graded.reduce((sum, item) => sum + ((item.grade ?? 0) / item.maxGrade) * 100, 0) /
            graded.length
        )
      : null;

  return (
    <AppShell title="My grades">
      <PageHeader
        eyebrow="Results and grading"
        title="My grades"
        description="All your submissions, grades, and teacher feedback in one place."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          icon={GraduationCap}
          label="Overall average"
          value={average !== null ? `${average}%` : "—"}
          tone="green"
          hint="From graded assignments"
        />
        <StatCard
          icon={GraduationCap}
          label="Graded assignments"
          value={graded.length}
          hint="Grade received"
          className="stagger-1"
        />
        <StatCard
          icon={GraduationCap}
          label="Total submissions"
          value={grades.length}
          tone="amber"
          hint="Submitted or graded"
          className="stagger-2"
        />
      </div>

      <Card className="mt-6 border-border/80 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">Grade history</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {gradesQuery.isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              Loading grades...
            </div>
          ) : grades.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No submissions yet"
              description="Submit your first assignment; its grade will appear here once your teacher grades it."
              action={
                <Button size="sm" asChild>
                  <Link href="/student/assignments">Go to assignments</Link>
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border/70">
              {grades.map(item => (
                <div key={item.id} className="flex flex-wrap items-center gap-4 py-4 first:pt-1 last:pb-1">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/student/assignments/${item.assignmentId}`}
                      className="line-clamp-1 text-sm font-medium text-ink hover:text-primary"
                    >
                      {item.assignmentTitle}
                    </Link>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Submitted {formatDateTime(item.submittedAt)}
                    </div>
                    {item.feedback && (
                      <div className="mt-2 inline-flex items-start gap-1.5 rounded-lg bg-secondary/60 px-2.5 py-1.5 text-[11px] leading-5 text-muted-foreground">
                        <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {item.feedback}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.grade !== null ? (
                      <span className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                        {item.grade} / {item.maxGrade}
                      </span>
                    ) : (
                      <span className="rounded-xl bg-amber/15 px-4 py-2 text-xs font-medium text-[#8a5a10]">
                        Awaiting grading
                      </span>
                    )}
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/student/assignments/${item.assignmentId}`}>
                        <Paperclip className="ml-1 h-3.5 w-3.5" />
                        Details
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
