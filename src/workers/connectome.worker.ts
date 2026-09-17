/// <reference lib="webworker" />
/**
 * Fetches the on-chain connectome inscription and decodes it off the main
 * thread, so pulling ~284 KB of Bitcoin-inscribed wiring never stutters the
 * world. Posts back plain typed arrays.
 */

import { buildGraph, decodeConnectome } from "@/lib/connectome-onchain";

type Request = { urls: string[]; edges: number; nodes: number };

self.onmessage = async (event: MessageEvent<Request>) => {
  const { urls, edges, nodes } = event.data;
  try {
    let raw: Uint8Array | null = null;
    let lastError: unknown = null;
    for (const url of urls) {
      try {
        const response = await fetch(url, { mode: "cors" });
        if (!response.ok) throw new Error(`${response.status}`);
        raw = new Uint8Array(await response.arrayBuffer());
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!raw) throw lastError ?? new Error("connectome unreachable");

    const graph = buildGraph(await decodeConnectome(raw), edges, nodes);
    const members = graph.members;
    const transfer: ArrayBufferLike[] = [
      graph.pre.buffer,
      graph.post.buffer,
      graph.weight.buffer,
      ...Object.values(members).map((m) => m.buffer),
    ];
    (self as unknown as Worker).postMessage(
      { ok: true, graph: { nodes: graph.nodes, pre: graph.pre, post: graph.post, weight: graph.weight, members, stats: graph.stats } },
      transfer as unknown as Transferable[],
    );
  } catch (error) {
    (self as unknown as Worker).postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
