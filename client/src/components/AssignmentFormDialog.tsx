import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toRiyadhDateInput, toRiyadhTimeInput } from "@/lib/format";
import { trpc } from "@/lib/trpc";

export type EditableAssignment = {
  id: number;
  title: string;
  description?: string | null;
  dueAt: Date | string;
  maxGrade: number;
};

function defaultDue() {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrow.setMinutes(0, 0, 0);
  return { date: toRiyadhDateInput(tomorrow), time: toRiyadhTimeInput(tomorrow) };
}

export function AssignmentFormDialog({
  open,
  onOpenChange,
  assignment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment?: EditableAssignment | null;
}) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(defaultDue().date);
  const [time, setTime] = useState(defaultDue().time);
  const [maxGrade, setMaxGrade] = useState("100");

  useEffect(() => {
    if (!open) return;
    if (assignment) {
      setTitle(assignment.title);
      setDescription(assignment.description ?? "");
      setDate(toRiyadhDateInput(assignment.dueAt));
      setTime(toRiyadhTimeInput(assignment.dueAt));
      setMaxGrade(String(assignment.maxGrade));
    } else {
      const due = defaultDue();
      setTitle("");
      setDescription("");
      setDate(due.date);
      setTime(due.time);
      setMaxGrade("100");
    }
  }, [open, assignment]);

  const onSuccess = async () => {
    toast.success(assignment ? "Assignment updated" : "Assignment created");
    await Promise.all([
      utils.teacher.assignments.list.invalidate(),
      utils.teacher.overview.invalidate(),
      utils.student.assignments.invalidate(),
      utils.student.overview.invalidate(),
    ]);
    onOpenChange(false);
  };

  const create = trpc.teacher.assignments.create.useMutation({
    onSuccess,
    onError: error => toast.error(error.message),
  });
  const update = trpc.teacher.assignments.update.useMutation({
    onSuccess,
    onError: error => toast.error(error.message),
  });
  const pending = create.isPending || update.isPending;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (title.trim().length < 3) return toast.error("Enter an assignment title");
    const dueAt = new Date(`${date}T${time}:00+03:00`);
    if (Number.isNaN(dueAt.getTime())) return toast.error("Invalid due date");
    const grade = Number(maxGrade);
    if (!Number.isFinite(grade) || grade < 1 || grade > 1000) {
      return toast.error("Maximum grade must be between 1 and 1000");
    }
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      dueAt: dueAt.toISOString(),
      maxGrade: grade,
    };
    if (assignment) update.mutate({ id: assignment.id, ...payload });
    else create.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" dir="ltr">
        <DialogHeader>
          <DialogTitle className="font-display">
            {assignment ? "Edit assignment" : "New assignment"}
          </DialogTitle>
          <DialogDescription>
            The assignment will appear to your students with its deadline and maximum grade.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assignment-title">Assignment title</Label>
            <Input
              id="assignment-title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="Example: Complete the exercises on page 42"
              className="bg-background/60"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assignment-description">Assignment instructions</Label>
            <Textarea
              id="assignment-description"
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="Explain what students should do. They can attach a file or write their answer."
              className="min-h-24 bg-background/60"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="assignment-date">Due date</Label>
              <Input
                id="assignment-date"
                type="date"
                value={date}
                onChange={event => setDate(event.target.value)}
                className="bg-background/60"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignment-time">Deadline (Riyadh time)</Label>
              <Input
                id="assignment-time"
                type="time"
                value={time}
                onChange={event => setTime(event.target.value)}
                className="bg-background/60"
                dir="ltr"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assignment-grade">Maximum grade</Label>
            <Input
              id="assignment-grade"
              type="number"
              min={1}
              max={1000}
              value={maxGrade}
              onChange={event => setMaxGrade(event.target.value)}
              className="bg-background/60"
              dir="ltr"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : assignment ? (
                "Save changes"
              ) : (
                "Publish assignment"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
