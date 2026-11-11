import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileUp,
  Loader2,
  Paperclip,
  Send,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageHeader, StatusPill } from "@/components/PageParts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes, formatDateTime, formatRelative } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { uploadHomeworkFile } from "@/lib/upload";

export default function StudentAssignmentDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const utils = trpc.useUtils();
  const fileInput = useRef<HTMLInputElement>(null);

  const query = trpc.student.assignments.get.useQuery(
    { id },
    { enabled: Number.isInteger(id) && id > 0 }
  );
  const data = query.data;

  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (data?.submission) {
      setContent(data.submission.content ?? "");
    }
  }, [data?.submission?.id]);

  const submitMutation = trpc.student.assignments.submit.useMutation({
    onSuccess: async () => {
      toast.success("Assignment submitted successfully");
      setFile(null);
      setUploadProgress(null);
      await Promise.all([
        utils.student.assignments.get.invalidate({ id }),
        utils.student.assignments.list.invalidate(),
        utils.student.overview.invalidate(),
        utils.student.submissions.mine.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const handleSubmit = async () => {
    if (!data) return;
    if (!content.trim() && !file && !data.submission?.fileUrl) {
      toast.error("Add text or a file before submitting");
      return;
    }
    setSubmitting(true);
    try {
      let fileKey: string | null = data.submission?.fileUrl
        ? data.submission.fileUrl.replace("/manus-storage/", "")
        : null;
      let fileName = data.submission?.fileName ?? null;
      if (file) {
        setUploadProgress(0);
        const uploaded = await uploadHomeworkFile(file, setUploadProgress);
        fileKey = uploaded.key;
        fileName = uploaded.fileName;
      }
      await submitMutation.mutateAsync({
        assignmentId: id,
        content: content.trim() || null,
        fileKey,
        fileName,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload the file");
    } finally {
      setSubmitting(false);
    }
  };

  if (query.isLoading) {
    return (
      <AppShell title="assignment">
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          In progress Loading assignment...
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell title="assignment">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <h2 className="font-display text-lg font-semibold">Assignment not found</h2>
          <Button className="mt-5" asChild>
            <Link href="/student/assignments">Back to assignments</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const { assignment, submission, teacherName, canSubmit } = data;
  const closed = new Date(assignment.dueAt).getTime() < Date.now();
  const status = submission
    ? submission.grade !== null
      ? "graded"
      : "submitted"
    : closed
      ? "missed"
      : "pending";

  return (
    <AppShell title={assignment.title}>
      <Link
        href="/student/assignments"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-ink"
      >
        <ArrowRight className="h-4 w-4" />
        All assignments
      </Link>

      <PageHeader
        eyebrow={`${teacherName} · Last deadline ${formatDateTime(assignment.dueAt)}`}
        title={assignment.title}
        description={assignment.description ?? undefined}
        actions={<StatusPill status={status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          {submission?.grade !== null && submission?.grade !== undefined && (
            <Card className="overflow-hidden border-emerald-200 bg-emerald-50/70">
              <CardContent className="flex flex-wrap items-center gap-5 p-5">
                <div className="flex h-20 w-20 flex-col items-center justify-center rounded-2xl bg-emerald-600 text-white">
                  <span className="font-display text-2xl font-bold">{submission.grade}</span>
                  <span className="text-[10px] opacity-80">from {assignment.maxGrade}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-display text-base font-semibold text-ink">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Your assignment has been graded
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Graded by {teacherName} {submission.gradedAt ? `· ${formatDateTime(submission.gradedAt)}` : ""}
                  </p>
                  {submission.feedback && (
                    <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-sm leading-6 text-ink">
                      {submission.feedback}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {canSubmit ? (
            <Card className="border-border/80 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-display text-base">
                  <Send className="h-4 w-4 text-primary" />
                  {submission ? "Update your submission" : "Submit assignment"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="submission-content">Your written answer</Label>
                  <Textarea
                    id="submission-content"
                    value={content}
                    onChange={event => setContent(event.target.value)}
                    placeholder="Write your answer here, or attach a file containing your solution..."
                    className="min-h-36 bg-background/60"
                    maxLength={5000}
                  />
                  <div className="text-left text-[11px] text-muted-foreground">
                    {content.length}/5000
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Attached file (optional)</Label>
                  {file ? (
                    <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-3">
                      <Paperclip className="h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-ink">{file.name}</div>
                        <div className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</div>
                        {uploadProgress !== null && (
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFile(null);
                          setUploadProgress(null);
                          if (fileInput.current) fileInput.current.value = "";
                        }}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
                        aria-label="Remove file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-background/50 px-4 py-7 text-center transition-colors hover:border-primary/30 hover:bg-primary/[0.03]"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <FileUp className="h-5 w-5" />
                      </span>
                      <span className="text-sm font-medium text-ink">Choose a solution file</span>
                      <span className="text-[11px] text-muted-foreground">
                        PDF, images, Word, PowerPoint, Excel, text, or ZIP — up to 25 MB
                      </span>
                    </button>
                  )}
                  <input
                    ref={fileInput}
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"
                    onChange={event => {
                      const selected = event.target.files?.[0];
                      if (!selected) return;
                      if (selected.size > 25 * 1024 * 1024) {
                        toast.error("File size must be less than 25 MB");
                        return;
                      }
                      setFile(selected);
                      setUploadProgress(null);
                    }}
                  />
                  {submission?.fileUrl && !file && (
                    <p className="text-[11px] text-muted-foreground">
                      You have a previous attachment:{" "}
                      <a
                        href={submission.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {submission.fileName ?? "Open file"}
                      </a>
                      . Choosing a new file will replace it.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-border pt-4">
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    submission {formatRelative(assignment.dueAt)}
                  </span>
                  <Button onClick={handleSubmit} disabled={submitting || submitMutation.isPending}>
                    {submitting ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        {uploadProgress !== null && uploadProgress < 100
                          ? `Uploading ${uploadProgress}%`
                          : "Submitting..."}
                      </>
                    ) : (
                      <>
                        <Send className="ml-1 h-4 w-4" />
                        {submission ? "Update submission" : "Submit assignment"}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/80 bg-card">
              <CardContent className="p-5">
                {closed && !submission && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    This assignment is past due and you have not submitted it. Contact your teacher if you have an excuse.
                  </div>
                )}
                {submission && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-base font-semibold">Your submission</h3>
                      <StatusPill status={status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Submitted {formatDateTime(submission.submittedAt)}
                    </p>
                    {submission.content && (
                      <div className="whitespace-pre-line rounded-xl bg-background/60 p-4 text-sm leading-7 text-ink">
                        {submission.content}
                      </div>
                    )}
                    {submission.fileUrl && (
                      <a
                        href={submission.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {submission.fileName ?? "Attached file"}
                      </a>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {submission && canSubmit && (
            <Card className="border-border/80 bg-card">
              <CardContent className="p-5 text-sm">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-display text-base font-semibold">Your current submission</h3>
                  <StatusPill status={status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Submitted {formatDateTime(submission.submittedAt)} — You can Update submission before scheduled time final.
                </p>
                {submission.content && (
                  <div className="mt-3 whitespace-pre-line rounded-xl bg-background/60 p-3 text-sm leading-7 text-ink">
                    {submission.content}
                  </div>
                )}
                {submission.fileUrl && (
                  <a
                    href={submission.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-xs text-primary hover:underline"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    {submission.fileName ?? "Attached file"}
                  </a>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base">Assignment details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <UserRound className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">teacher</div>
                  <div className="mt-0.5 font-medium text-ink">{teacherName}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Submission deadline</div>
                  <div className="mt-0.5 font-medium text-ink">{formatDateTime(assignment.dueAt)}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Maximum grade</div>
                  <div className="mt-0.5 font-medium text-ink">{assignment.maxGrade}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber/25 bg-amber/[0.06]">
            <CardContent className="p-5 text-xs leading-6 text-muted-foreground">
              <strong className="text-ink">Before submitting:</strong> Make sure your file opens correctly and your
              answer is complete. You can update your submission any time before the deadline.
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
