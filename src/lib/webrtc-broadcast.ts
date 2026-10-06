// Peer-to-peer WebRTC live channel per BITMAP. Signaling rides an ephemeral
// realtime broadcast channel `bitmap-live:<height>`; video goes browser→browser.
// Nothing is stored. One broadcaster fans out to each viewer with its own peer.
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};
const rid = () => Math.random().toString(36).slice(2, 10);
const chan = (h: number) => `bitmap-live:${h}`;

type Msg = { from: string; to?: string; sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit };

/** Broadcaster: streams `stream` to every viewer that joins this BITMAP's channel. */
export function startBroadcast(height: number, stream: MediaStream, onViewers: (n: number) => void) {
  const id = rid();
  const peers = new Map<string, RTCPeerConnection>();
  const channel = supabase.channel(chan(height), { config: { broadcast: { self: false } } });
  const send = (event: string, payload: Msg) => void channel.send({ type: "broadcast", event, payload });
  const drop = (vid: string) => { peers.get(vid)?.close(); peers.delete(vid); onViewers(peers.size); };

  channel
    .on("broadcast", { event: "join" }, async ({ payload }) => {
      const vid = (payload as Msg).from;
      if (!vid) return;
      drop(vid);
      const pc = new RTCPeerConnection(ICE);
      peers.set(vid, pc);
      onViewers(peers.size);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.onicecandidate = (e) => e.candidate && send("ice", { from: id, to: vid, ice: e.candidate.toJSON() });
      pc.onconnectionstatechange = () => {
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) drop(vid);
      };
      await pc.setLocalDescription(await pc.createOffer());
      send("offer", { from: id, to: vid, sdp: pc.localDescription!.toJSON() });
    })
    .on("broadcast", { event: "answer" }, async ({ payload }) => {
      const p = payload as Msg;
      if (p.to !== id || !p.sdp) return;
      await peers.get(p.from)?.setRemoteDescription(p.sdp).catch(() => {});
    })
    .on("broadcast", { event: "ice" }, async ({ payload }) => {
      const p = payload as Msg;
      if (p.to !== id || !p.ice) return;
      await peers.get(p.from)?.addIceCandidate(p.ice).catch(() => {});
    })
    .on("broadcast", { event: "leave" }, ({ payload }) => drop((payload as Msg).from))
    .subscribe((status) => {
      if (status === "SUBSCRIBED") send("live", { from: id });
    });

  // Re-announce so late page loads discover the stream.
  const beacon = window.setInterval(() => send("live", { from: id }), 4000);
  return () => {
    window.clearInterval(beacon);
    send("ended", { from: id });
    peers.forEach((pc) => pc.close());
    peers.clear();
    window.setTimeout(() => void supabase.removeChannel(channel), 300);
  };
}

/** Viewer: returns the live remote stream for a BITMAP, or null when nobody is broadcasting. */
export function useBitmapLiveStream(height: number) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (height < 0) return;
    const id = rid();
    let host: string | null = null;
    let lastBeacon = 0;
    const channel = supabase.channel(chan(height), { config: { broadcast: { self: false } } });
    const send = (event: string, payload: Msg) => void channel.send({ type: "broadcast", event, payload });
    const reset = () => { pcRef.current?.close(); pcRef.current = null; host = null; setStream(null); setLive(false); };

    channel
      .on("broadcast", { event: "live" }, ({ payload }) => {
        lastBeacon = Date.now();
        const from = (payload as Msg).from;
        if (host === from && pcRef.current && pcRef.current.connectionState !== "failed") return;
        setLive(true);
        send("join", { from: id });
      })
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        const p = payload as Msg;
        if (p.to !== id || !p.sdp) return;
        pcRef.current?.close();
        host = p.from;
        lastBeacon = Date.now();
        setLive(true);
        const pc = new RTCPeerConnection(ICE);
        pcRef.current = pc;
        pc.ontrack = (e) => setStream(e.streams[0] ?? new MediaStream([e.track]));
        pc.onicecandidate = (e) => e.candidate && send("ice", { from: id, to: p.from, ice: e.candidate.toJSON() });
        await pc.setRemoteDescription(p.sdp);
        await pc.setLocalDescription(await pc.createAnswer());
        send("answer", { from: id, to: p.from, sdp: pc.localDescription!.toJSON() });
      })
      .on("broadcast", { event: "ice" }, async ({ payload }) => {
        const p = payload as Msg;
        if (p.to !== id || !p.ice) return;
        await pcRef.current?.addIceCandidate(p.ice).catch(() => {});
      })
      .on("broadcast", { event: "ended" }, reset)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") send("join", { from: id });
      });

    const watchdog = window.setInterval(() => {
      if (lastBeacon && Date.now() - lastBeacon > 90_000 && pcRef.current?.connectionState !== "connected") { lastBeacon = 0; reset(); }
    }, 3000);
    return () => {
      window.clearInterval(watchdog);
      send("leave", { from: id });
      pcRef.current?.close();
      window.setTimeout(() => void supabase.removeChannel(channel), 300);
    };
  }, [height]);

  return { stream, live };
}
