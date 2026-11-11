import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { Loader2, MonitorUp, Radio, Square, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageParts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/session";
import { useAuth } from "@/hooks/useAuth";

type Room = {
  lesson?: { id: number; title: string; status: string; startedAt?: string | null };
  participant?: { userId: number; name: string; role: string };
  participants?: { userId: number; name: string; role: string; handRaised?: boolean }[];
  seq?: number;
  ended?: boolean;
};

export default function LiveLesson() {
  const { id } = useParams<{ id: string }>();
  const lessonId = Number(id);
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const seqRef = useRef(0);

  const enterRoom = async () => {
    if (!Number.isInteger(lessonId) || lessonId < 1) {
      setError("Invalid lesson link");
      setLoading(false);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = user?.role === "teacher"
        ? await apiRequest<{ lesson: Room["lesson"] }>("/api/live/control", {
            method: "POST",
            body: { lessonId, action: "start" },
          })
        : await apiRequest<Room>("/api/live/join", {
            method: "POST",
            body: { lessonId },
          });
      if (user?.role === "teacher") {
        setRoom({ lesson: result.lesson, participant: { userId: user.id, name: user.name, role: user.role }, participants: [] });
      } else {
        setRoom(result);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to enter the lesson");
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    void enterRoom();
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
      void apiRequest("/api/live/leave", { method: "POST", body: { lessonId } }).catch(() => undefined);
    };
  }, [lessonId, user?.id]);

  useEffect(() => {
    if (!room) return;
    const timer = window.setInterval(async () => {
      try {
        const state = await apiRequest<Room & { seq?: number }>(`/api/live/state?lessonId=${lessonId}&since=${seqRef.current}`);
        if (typeof state.seq === "number") seqRef.current = state.seq;
        setRoom(current => ({ ...current, ...state, lesson: current?.lesson ?? state.lesson }));
      } catch {
        // The room can briefly be unavailable while Railway restarts the service.
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [lessonId, room !== null]);

  const shareScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setSharing(true);
      stream.getVideoTracks()[0]?.addEventListener("ended", () => setSharing(false));
    } catch {
      toast.error("Screen sharing was cancelled or blocked by the browser");
    }
  };

  const endLesson = async () => {
    setBusy(true);
    try {
      await apiRequest("/api/live/control", { method: "POST", body: { lessonId, action: "end" } });
      streamRef.current?.getTracks().forEach(track => track.stop());
      setSharing(false);
      toast.success("Lesson ended and recording saved");
      setRoom(current => ({ ...current, lesson: current?.lesson ? { ...current.lesson, status: "ended" } : undefined }));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to end the lesson");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <AppShell title="Live lesson"><div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;
  }

  if (error) {
    return <AppShell title="Live lesson"><Card><CardContent className="p-8 text-center"><h2 className="font-display text-lg font-semibold">Unable to open this lesson</h2><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button className="mt-5" asChild><Link href={user?.role === "teacher" ? "/teacher/lessons" : "/student/lessons"}>Back to lessons</Link></Button></CardContent></Card></AppShell>;
  }

  const isTeacher = user?.role === "teacher";
  const ended = room?.lesson?.status === "ended" || room?.ended;

  return (
    <AppShell title={room?.lesson?.title ?? "Live lesson"}>
      <PageHeader
        eyebrow={ended ? "Lesson ended" : "Live classroom"}
        title={room?.lesson?.title ?? "Lesson"}
        description={ended ? "This lesson has ended." : "The live room is open. The teacher can share a screen and the session is recorded automatically."}
        actions={<Button variant="outline" asChild><Link href={isTeacher ? "/teacher/lessons" : "/student/lessons"}>Back to lessons</Link></Button>}
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/70">
            <CardTitle className="flex items-center gap-2 font-display text-base"><Radio className={ended ? "h-4 w-4 text-muted-foreground" : "h-4 w-4 text-red-600"} />{ended ? "Ended" : "Live now"}</CardTitle>
            {!ended && isTeacher && <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">Recording active</span>}
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-slate-950">
              {sharing ? <video ref={videoRef} className="h-full w-full object-contain" muted playsInline /> : <div className="text-center text-white/60"><Video className="mx-auto mb-3 h-10 w-10" /><p>{isTeacher ? "Share your screen to begin explaining" : "Waiting for the teacher's shared screen"}</p></div>}
            </div>
            {!ended && isTeacher && <div className="flex flex-wrap gap-2"><Button onClick={shareScreen} disabled={sharing}><MonitorUp className="ml-1 h-4 w-4" />{sharing ? "Screen sharing on" : "Share screen"}</Button><Button variant="destructive" onClick={endLesson} disabled={busy}><Square className="ml-1 h-4 w-4" />End lesson</Button></div>}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardHeader><CardTitle className="flex items-center gap-2 font-display text-base"><Users className="h-4 w-4 text-primary" />Participants</CardTitle></CardHeader>
          <CardContent className="space-y-3">{(room?.participants ?? []).length === 0 ? <p className="text-sm text-muted-foreground">You are the first person in the room.</p> : room?.participants?.map(participant => <div key={participant.userId} className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2 text-sm"><span>{participant.name}</span><span className="text-xs text-muted-foreground">{participant.role}</span></div>)}</CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
