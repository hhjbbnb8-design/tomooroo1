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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toRiyadhDateInput, toRiyadhTimeInput } from "@/lib/format";
import { trpc } from "@/lib/trpc";

export type EditableLesson = {
  id: number;
  title: string;
  description?: string | null;
  scheduledAt: Date | string;
  durationMinutes: number;
};

function defaultSchedule() {
  const next = new Date(Date.now() + 60 * 60 * 1000);
  next.setMinutes(next.getMinutes() < 30 ? 30 : 0, 0, 0);
  if (next.getMinutes() === 0) next.setHours(next.getHours() + 1);
  return {
    date: toRiyadhDateInput(next),
    time: toRiyadhTimeInput(next),
  };
}

export function LessonFormDialog({
  open,
  onOpenChange,
  lesson,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson?: EditableLesson | null;
  onSaved?: () => void;
}) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(defaultSchedule().date);
  const [time, setTime] = useState(defaultSchedule().time);
  const [duration, setDuration] = useState("60");

  useEffect(() => {
    if (!open) return;
    if (lesson) {
      setTitle(lesson.title);
      setDescription(lesson.description ?? "");
      setDate(toRiyadhDateInput(lesson.scheduledAt));
      setTime(toRiyadhTimeInput(lesson.scheduledAt));
      setDuration(String(lesson.durationMinutes));
    } else {
      const schedule = defaultSchedule();
      setTitle("");
      setDescription("");
      setDate(schedule.date);
      setTime(schedule.time);
      setDuration("60");
    }
  }, [open, lesson]);

  const onSuccess = async () => {
    toast.success(lesson ? "Lesson updated" : "Lesson created");
    await Promise.all([
      utils.teacher.lessons.list.invalidate(),
      utils.teacher.overview.invalidate(),
      utils.student.lessons.invalidate(),
    ]);
    onOpenChange(false);
    onSaved?.();
  };

  const create = trpc.teacher.lessons.create.useMutation({
    onSuccess,
    onError: error => toast.error(error.message),
  });
  const update = trpc.teacher.lessons.update.useMutation({
    onSuccess,
    onError: error => toast.error(error.message),
  });

  const pending = create.isPending || update.isPending;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (title.trim().length < 3) return toast.error("Enter a lesson title");
    const scheduledAt = new Date(`${date}T${time}:00+03:00`);
    if (Number.isNaN(scheduledAt.getTime())) return toast.error("Invalid date or time");
    const durationMinutes = Number(duration);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 300) {
      return toast.error("Duration must be between 15 and 300 minutes");
    }
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes,
    };
    if (lesson) update.mutate({ id: lesson.id, ...payload });
    else create.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" dir="ltr">
        <DialogHeader>
          <DialogTitle className="font-display">
            {lesson ? "Edit lesson" : "New lesson"}
          </DialogTitle>
          <DialogDescription>
            Set the lesson time and duration; it will appear to your students immediately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lesson-title">Lesson title</Label>
            <Input
              id="lesson-title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="Example: Chapter 3 review — fractions"
              className="bg-background/60"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lesson-description">Short description (optional)</Label>
            <Textarea
              id="lesson-description"
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="What will we cover in this lesson?"
              className="min-h-20 bg-background/60"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lesson-date">Date</Label>
              <Input
                id="lesson-date"
                type="date"
                value={date}
                onChange={event => setDate(event.target.value)}
                className="bg-background/60"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-time">Start time (Riyadh time)</Label>
              <Input
                id="lesson-time"
                type="time"
                value={time}
                onChange={event => setTime(event.target.value)}
                className="bg-background/60"
                dir="ltr"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="w-full bg-background/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[30, 45, 60, 75, 90, 120, 150, 180].map(minutes => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {minutes} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              ) : lesson ? (
                "Save changes"
              ) : (
                "Create lesson"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
