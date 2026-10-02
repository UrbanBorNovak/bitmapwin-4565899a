// Zero-install broadcaster: captures the Oasis 3D canvas (or a shared tab) plus
// the mic, sends it over WebRTC/WHIP to the edge relay, which pushes RTMP to Kick.
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { openKickRelay, closeKickRelay } from "@/lib/kick-relay.functions";

const URL_KEY = "bitmapwin:kick-rtmp-url";
const DEFAULT_URL = "rtmps://fa723fc1b171.global-contribute.live-video.net:443/app/";

type Live = { pc: RTCPeerConnection; stream: MediaStream; uid: string; resource: string | null; started: number };

export function GoLiveKick({ label }: { label: string }) {
  const open = useServerFn(openKickRelay);
  const close = useServerFn(closeKickRelay);
  const [rtmpUrl, setRtmpUrl] = useState(DEFAULT_URL);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const preview = useRef<HTMLVideoElement>(null);
  const liveRef = useRef<Live | null>(null);

  useEffect(() => {
    const u = localStorage.getItem(URL_KEY);
    if (u) setRtmpUrl(u);
  }, []);
  useEffect(() => {
    liveRef.current = live;
    if (!live) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - live.started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [live]);
  useEffect(() => () => void stop(), []);

  async function capture(): Promise<MediaStream> {
    const canvas = document.querySelector<HTMLCanvasElement>("canvas[data-engine], main canvas, canvas");
    let video: MediaStream;
    if (canvas && canvas.width > 300 && "captureStream" in canvas) video = canvas.captureStream(60);
    else video = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 60 }, audio: true });
    const out = new MediaStream(video.getVideoTracks());
    video.getAudioTracks().forEach((t) => out.addTrack(t));
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      mic.getAudioTracks().forEach((t) => out.addTrack(t));
    } catch {
      /* broadcast without mic */
    }
    return out;
  }

  async function start() {
    setError(null);
    const k = key.trim();
    if (!/^rtmps?:\/\//.test(rtmpUrl.trim()) || k.length < 8) {
      setError("PASTE YOUR KICK STREAM URL AND STREAM KEY");
      return;
    }
    let stream: MediaStream | null = null;
    let uid: string | null = null;
    try {
      setBusy("CAPTURING…");
      stream = await capture();
      setBusy("OPENING RELAY…");
      const res = await open({ data: { rtmpUrl: rtmpUrl.trim(), streamKey: k, label } });
      if (!res.ok) throw new Error(res.reason);
      uid = res.uid;
      localStorage.setItem(URL_KEY, rtmpUrl.trim());
      setBusy("CONNECTING…");
      const pc = new RTCPeerConnection({ bundlePolicy: "max-bundle" });
      stream.getTracks().forEach((t) => pc.addTransceiver(t, { direction: "sendonly", streams: [stream!] }));
      await pc.setLocalDescription(await pc.createOffer());
      await new Promise<void>((r) => {
        if (pc.iceGatheringState === "complete") return r();
        const to = setTimeout(r, 2000);
        pc.addEventListener("icegatheringstatechange", () => {
          if (pc.iceGatheringState === "complete") (clearTimeout(to), r());
        });
      });
      const ans = await fetch(res.whipUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription!.sdp,
      });
      if (!ans.ok) throw new Error("THE RELAY REFUSED THE VIDEO FEED");
      const loc = ans.headers.get("location");
      await pc.setRemoteDescription({ type: "answer", sdp: await ans.text() });
      pc.addEventListener("connectionstatechange", () => {
        if (pc.connectionState === "failed") (setError("CONNECTION LOST"), void stop());
      });
      if (preview.current) preview.current.srcObject = stream;
      setKey("");
      setLive({ pc, stream, uid, resource: loc ? new URL(loc, res.whipUrl).toString() : null, started: Date.now() });
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      if (uid) void close({ data: { uid } });
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function stop() {
    const l = liveRef.current;
    if (!l) return;
    liveRef.current = null;
    setLive(null);
    l.stream.getTracks().forEach((t) => t.stop());
    l.pc.close();
    if (l.resource) void fetch(l.resource, { method: "DELETE" }).catch(() => {});
    void close({ data: { uid: l.uid } });
    setElapsed(0);
  }

  const toggleMic = () => {
    const next = !muted;
    live?.stream.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="space-y-3 font-mono text-[12px]">
      <p className="label text-bitcoin">GO LIVE ON KICK · NO SOFTWARE NEEDED</p>
      {live ? (
        <>
          <video ref={preview} muted autoPlay playsInline className="aspect-video w-full border border-border bg-card" />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-bitcoin">● LIVE {mm}:{ss}</span>
            <button type="button" onClick={toggleMic} className="label hover:text-signal">
              {muted ? "[ UNMUTE MIC ]" : "[ MUTE MIC ]"}
            </button>
            <button type="button" onClick={() => void stop()} className="label text-bitcoin hover:underline">
              [ END STREAM ]
            </button>
          </div>
        </>
      ) : (
        <>
          <input
            value={rtmpUrl}
            onChange={(e) => setRtmpUrl(e.target.value)}
            placeholder="Kick stream URL"
            className="w-full border border-border bg-card px-3 py-2 text-foreground outline-none focus:border-signal"
          />
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Kick stream key"
            autoComplete="off"
            className="w-full border border-border bg-card px-3 py-2 text-foreground outline-none focus:border-signal"
          />
          <button type="button" disabled={!!busy} onClick={() => void start()} className="btn-term w-full px-4 py-2 disabled:opacity-40">
            {busy ?? "[ GO LIVE ON KICK ]"}
          </button>
          <p className="text-muted-foreground">
            &gt; Find both in Kick → Creator Dashboard → Settings → Stream URL &amp; Key. Inside the Oasis we send the 3D
            world itself; elsewhere you pick a tab or window to share. The key is used once and never saved.
          </p>
        </>
      )}
      {error && <p className="text-bitcoin">⚠ {error}</p>}
    </div>
  );
}
