import { useEffect, useState } from "react";

/**
 * Live mempool.space websocket watcher. Tracks one txid and fires `onEvent`
 * the moment a block confirms it (or any new block arrives, as a safety net),
 * so callers re-read their note instead of polling on a timer.
 */
export type MempoolWatchState = "idle" | "connecting" | "live" | "offline";

const WS_MIRRORS = ["wss://mempool.space/api/v1/ws", "wss://mempool.emzy.de/api/v1/ws"];

export function useMempoolWatch(txid: string | null | undefined, onEvent: () => void): MempoolWatchState {
  const [state, setState] = useState<MempoolWatchState>("idle");
  useEffect(() => {
    if (!txid || typeof WebSocket === "undefined") {
      setState("idle");
      return;
    }
    let ws: WebSocket | null = null;
    let closed = false;
    let attempt = 0;
    let timer: number | undefined;

    const open = () => {
      if (closed) return;
      setState("connecting");
      ws = new WebSocket(WS_MIRRORS[attempt % WS_MIRRORS.length]);
      ws.onopen = () => {
        attempt = 0;
        setState("live");
        ws?.send(JSON.stringify({ action: "want", data: ["blocks"] }));
        ws?.send(JSON.stringify({ "track-tx": txid }));
      };
      ws.onmessage = (m) => {
        try {
          const msg = JSON.parse(String(m.data)) as Record<string, unknown>;
          if (msg.txConfirmed || msg.block || msg.txReplaced) onEvent();
        } catch {
          /* ignore non-JSON frames */
        }
      };
      ws.onclose = () => {
        if (closed) return;
        setState("offline");
        attempt += 1;
        timer = window.setTimeout(open, Math.min(30_000, 2_000 * attempt));
      };
      ws.onerror = () => ws?.close();
    };
    open();
    return () => {
      closed = true;
      if (timer) window.clearTimeout(timer);
      ws?.close();
    };
  }, [txid, onEvent]);
  return state;
}
