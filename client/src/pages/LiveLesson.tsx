import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { Camera, CameraOff, Eraser, Loader2, Mic, MicOff, MonitorUp, PenLine, Radio, Square, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageParts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/session";
import { useAuth } from "@/hooks/useAuth";

type Participant = { userId: number; name: string; role: string; handRaised?: boolean };
type Lesson = { id: number; title: string; status: string; startedAt?: string | null };
type Signal = { seq: number; from: number; to: number | "*"; data: any };
type Room = { lesson?: Lesson; participant?: Participant; participants?: Participant[]; seq?: number; messages?: Signal[]; ended?: boolean };
type Point = { x: number; y: number; prevX: number; prevY: number; color: string; size: number };

export default function LiveLesson() {
  const { id } = useParams<{ id: string }>();
  const lessonId = Number(id);
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [whiteboardOn, setWhiteboardOn] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Record<number, MediaStream>>({});
  const [strokes, setStrokes] = useState<Point[]>([]);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<number, RTCPeerConnection>>({});
  const seqRef = useRef(0);
  const drawingRef = useRef(false);

  const sendSignal = useCallback(async (to: number | "*", data: unknown) => {
    await apiRequest("/api/live/signal", { method: "POST", body: { lessonId, to, data } });
  }, [lessonId]);

  const createPeer = useCallback(async (participant: Participant, initiator: boolean) => {
    if (!user || participant.userId === user.id || peersRef.current[participant.userId]) return;
    const peer = new RTCPeerConnection();
    peersRef.current[participant.userId] = peer;
    localStreamRef.current?.getTracks().forEach(track => peer.addTrack(track, localStreamRef.current!));
    peer.ontrack = event => {
      const stream = event.streams[0];
      if (stream) setRemoteStreams(current => ({ ...current, [participant.userId]: stream }));
    };
    peer.onicecandidate = event => {
      if (event.candidate) void sendSignal(participant.userId, { type: "ice", candidate: event.candidate });
    };
    peer.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(peer.connectionState)) {
        setRemoteStreams(current => { const next = { ...current }; delete next[participant.userId]; return next; });
      }
    };
    if (initiator) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await sendSignal(participant.userId, { type: "offer", offer });
    }
  }, [sendSignal, user]);

  const handleSignal = useCallback(async (message: Signal) => {
    const data = message.data || {};
    const participant = room?.participants?.find(item => item.userId === message.from);
    if (!participant || !user) return;
    if (data.type === "whiteboard") {
      setStrokes(current => [...current, data.point as Point]);
      return;
    }
    if (data.type === "whiteboard-clear") {
      setStrokes([]);
      return;
    }
    let peer = peersRef.current[message.from];
    if (data.type === "offer") {
      if (!peer) {
        await createPeer(participant, false);
        peer = peersRef.current[message.from];
      }
      if (!peer) return;
      await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await sendSignal(message.from, { type: "answer", answer });
    } else if (data.type === "answer" && peer) {
      await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.type === "ice" && peer && data.candidate) {
      await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  }, [createPeer, room?.participants, sendSignal, user]);

  const enterRoom = useCallback(async () => {
    if (!Number.isInteger(lessonId) || lessonId < 1) { setError("Invalid lesson link"); setLoading(false); return; }
    setBusy(true); setError("");
    try {
      const result = user?.role === "teacher"
        ? await apiRequest<{ lesson: Lesson }>("/api/live/control", { method: "POST", body: { lessonId, action: "start" } })
        : await apiRequest<Room>("/api/live/join", { method: "POST", body: { lessonId } });
      setRoom(user?.role === "teacher"
        ? { lesson: result.lesson, participant: { userId: user.id, name: user.name, role: user.role }, participants: [] }
        : result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to enter the lesson");
    } finally { setBusy(false); setLoading(false); }
  }, [lessonId, user]);

  useEffect(() => {
    void enterRoom();
    return () => {
      Object.values(peersRef.current).forEach(peer => peer.close());
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      displayStreamRef.current?.getTracks().forEach(track => track.stop());
      void apiRequest("/api/live/leave", { method: "POST", body: { lessonId } }).catch(() => undefined);
    };
  }, [enterRoom, lessonId]);

  useEffect(() => {
    if (!room) return;
    const timer = window.setInterval(async () => {
      try {
        const state = await apiRequest<Room & { seq?: number }>(`/api/live/state?lessonId=${lessonId}&since=${seqRef.current}`);
        if (typeof state.seq === "number") seqRef.current = state.seq;
        setRoom(current => ({ ...current, ...state, lesson: current?.lesson ?? state.lesson }));
        for (const message of state.messages ?? []) {
          seqRef.current = Math.max(seqRef.current, message.seq);
          await handleSignal(message);
        }
      } catch { /* transient network errors are retried on the next poll */ }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [handleSignal, lessonId, room]);

  useEffect(() => {
    if (!room?.participants || !user || !localStreamRef.current) return;
    room.participants.filter(participant => participant.userId !== user.id).forEach(participant => {
      void createPeer(participant, user.role === "teacher");
    });
  }, [createPeer, room?.participants, user]);

  const startMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) { localVideoRef.current.srcObject = stream; await localVideoRef.current.play().catch(() => undefined); }
      setCameraOn(true); setMicOn(true);
      room?.participants?.filter(participant => participant.userId !== user?.id).forEach(participant => void createPeer(participant, user?.role === "teacher"));
    } catch { toast.error("Allow camera and microphone access in the browser"); }
  };

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) { void startMedia(); return; }
    track.enabled = !track.enabled; setMicOn(track.enabled);
  };

  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) { void startMedia(); return; }
    track.enabled = !track.enabled; setCameraOn(track.enabled);
  };

  const shareScreen = async () => {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      displayStreamRef.current = display;
      const screenTrack = display.getVideoTracks()[0];
      const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
      Object.values(peersRef.current).forEach(peer => {
        const sender = peer.getSenders().find(item => item.track?.kind === "video");
        if (sender) void sender.replaceTrack(screenTrack);
      });
      if (localVideoRef.current) { localVideoRef.current.srcObject = display; await localVideoRef.current.play().catch(() => undefined); }
      setScreenOn(true);
      screenTrack.addEventListener("ended", () => {
        setScreenOn(false);
        if (cameraTrack) Object.values(peersRef.current).forEach(peer => peer.getSenders().find(item => item.track?.kind === "video")?.replaceTrack(cameraTrack));
        if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      });
    } catch { toast.error("Screen sharing was cancelled or blocked"); }
  };

  const endLesson = async () => {
    setBusy(true);
    try {
      await apiRequest("/api/live/control", { method: "POST", body: { lessonId, action: "end" } });
      setRoom(current => ({ ...current, lesson: current?.lesson ? { ...current.lesson, status: "ended" } : undefined, ended: true }));
      toast.success("Lesson ended and recording saved");
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Unable to end the lesson"); }
    finally { setBusy(false); }
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas || !drawingRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const point: Point = { x, y, prevX: x - 2, prevY: y - 2, color: "#f59e0b", size: 5 };
    setStrokes(current => [...current, point]);
    void sendSignal("*", { type: "whiteboard", point });
  };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const context = canvas.getContext("2d"); if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    strokes.forEach(point => { context.strokeStyle = point.color; context.lineWidth = point.size; context.beginPath(); context.moveTo(point.prevX, point.prevY); context.lineTo(point.x, point.y); context.stroke(); });
  }, [strokes]);

  if (loading) return <AppShell title="Live lesson"><div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;
  if (error) return <AppShell title="Live lesson"><Card><CardContent className="p-8 text-center"><h2 className="font-display text-lg font-semibold">Unable to open this lesson</h2><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button className="mt-5" asChild><Link href={user?.role === "teacher" ? "/teacher/lessons" : "/student/lessons"}>Back to lessons</Link></Button></CardContent></Card></AppShell>;

  const ended = room?.lesson?.status === "ended" || room?.ended;
  return <AppShell title={room?.lesson?.title ?? "Live lesson"}>
    <PageHeader eyebrow={ended ? "Lesson ended" : "Live classroom"} title={room?.lesson?.title ?? "Lesson"} description={ended ? "This lesson has ended." : "Camera, microphone, screen sharing and a shared whiteboard are available in this room."} actions={<Button variant="outline" asChild><Link href={user?.role === "teacher" ? "/teacher/lessons" : "/student/lessons"}>Back to lessons</Link></Button>} />
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <Card className="overflow-hidden border-border/80 bg-card"><CardHeader className="flex flex-row items-center justify-between border-b border-border/70"><CardTitle className="flex items-center gap-2 font-display text-base"><Radio className={ended ? "h-4 w-4 text-muted-foreground" : "h-4 w-4 text-red-600"} />{ended ? "Ended" : "Live now"}</CardTitle>{!ended && <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">Recording active</span>}</CardHeader><CardContent className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2"><div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-950"><video ref={localVideoRef} className="h-full w-full object-cover" muted playsInline /><span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">You</span></div>{Object.entries(remoteStreams).map(([participantId, stream]) => <RemoteVideo key={participantId} stream={stream} label={room?.participants?.find(item => item.userId === Number(participantId))?.name ?? "Participant"} />)}</div>
        {!ended && <div className="flex flex-wrap gap-2"><Button variant={micOn ? "outline" : "destructive"} onClick={toggleMic}>{micOn ? <Mic className="ml-1 h-4 w-4" /> : <MicOff className="ml-1 h-4 w-4" />}{micOn ? "Mute" : "Microphone"}</Button><Button variant={cameraOn ? "outline" : "destructive"} onClick={toggleCamera}>{cameraOn ? <Camera className="ml-1 h-4 w-4" /> : <CameraOff className="ml-1 h-4 w-4" />}{cameraOn ? "Camera on" : "Camera"}</Button><Button onClick={shareScreen} disabled={screenOn}><MonitorUp className="ml-1 h-4 w-4" />{screenOn ? "Screen shared" : "Share screen"}</Button><Button variant={whiteboardOn ? "default" : "outline"} onClick={() => setWhiteboardOn(value => !value)}><PenLine className="ml-1 h-4 w-4" />Whiteboard</Button>{user?.role === "teacher" && <Button variant="destructive" onClick={endLesson} disabled={busy}><Square className="ml-1 h-4 w-4" />End lesson</Button>}</div>}
        {whiteboardOn && <div className="overflow-hidden rounded-2xl border border-border bg-white"><div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground"><span>Shared whiteboard — draw with your finger or mouse</span><button type="button" className="inline-flex items-center gap-1 text-red-600" onClick={() => { setStrokes([]); void sendSignal("*", { type: "whiteboard-clear" }); }}><Eraser className="h-3.5 w-3.5" />Clear</button></div><canvas ref={canvasRef} width={1200} height={600} className="h-auto w-full touch-none" onPointerDown={event => { drawingRef.current = true; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={() => { drawingRef.current = false; }} onPointerMove={draw} /></div>}
      </CardContent></Card>
      <Card className="border-border/80 bg-card"><CardHeader><CardTitle className="flex items-center gap-2 font-display text-base"><Users className="h-4 w-4 text-primary" />Participants</CardTitle></CardHeader><CardContent className="space-y-3">{(room?.participants ?? []).length === 0 ? <p className="text-sm text-muted-foreground">You are the first person in the room.</p> : room?.participants?.map(participant => <div key={participant.userId} className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2 text-sm"><span>{participant.name}</span><span className="text-xs text-muted-foreground">{participant.role}</span></div>)}</CardContent></Card>
    </div>
  </AppShell>;
}

function RemoteVideo({ stream, label }: { stream: MediaStream; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) { ref.current.srcObject = stream; void ref.current.play().catch(() => undefined); } }, [stream]);
  return <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-950"><video ref={ref} className="h-full w-full object-cover" playsInline /><span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">{label}</span></div>;
}
