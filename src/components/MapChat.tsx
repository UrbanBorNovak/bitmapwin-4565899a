import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/lib/auth";
import { timeAgo } from "@/lib/bitmap";
import {
  MAP_CHAT_MAX_LENGTH,
  deleteMapChatMessage,
  mapChatQuery,
  sendMapChatMessage,
} from "@/lib/map-chat";
import { colorForVisitor, defaultHandle, mapHandle, mapVisitorId, setMapHandle } from "@/lib/map-identity";
import type { MapCursor } from "@/lib/map-presence";
import { shortenAddress } from "@/lib/registry";
import { useWalletSession } from "@/lib/wallet-session";

/**
 * Public chat next to the Oasis world map. Visitors talk about districts here, and the
 * colour beside each name is the same colour as that person's live cursor dot
 * on the map — so you can see who is online and where they are looking.
 */
export function MapChat({ cursors, className, listClassName }: { cursors: MapCursor[]; className?: string; listClassName?: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();
  const wallet = useWalletSession();
  const address = wallet?.ordinalsAddress ?? null;
  const [draft, setDraft] = useState("");
  const [district, setDistrict] = useState("");
  const [handle, setHandle] = useState("ANON");
  const [editingHandle, setEditingHandle] = useState(false);
  const [selfId, setSelfId] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelfId(mapVisitorId());
    setHandle(mapHandle());
  }, []);

  const messages = useQuery(mapChatQuery());

  useEffect(() => {
    const channel = supabase
      .channel(`map-chat-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "map_chat_messages" }, () =>
        queryClient.invalidateQueries({ queryKey: ["map-chat"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.data]);

  const send = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("SIGN IN TO CHAT");
      const height = district.trim() ? Number(district.trim()) : null;
      if (height !== null && (!Number.isInteger(height) || height < 0)) {
        throw new Error("DISTRICT MUST BE A BLOCK HEIGHT");
      }
      await sendMapChatMessage({
        userId: user.id,
        visitorId: selfId || mapVisitorId(),
        handle,
        senderAddress: address,
        districtHeight: height,
        body: draft,
      });
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["map-chat"] });
    },
    onError: (e) => toast("MESSAGE NOT SENT", { description: (e as Error).message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteMapChatMessage(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["map-chat"] }),
    onError: (e) => toast("DELETE FAILED", { description: (e as Error).message }),
  });

  const list = messages.data ?? [];
  const online = useMemo(() => {
    const seen = new Map<string, MapCursor>();
    for (const c of cursors) seen.set(c.id, c);
    return Array.from(seen.values());
  }, [cursors]);
  const onlineIds = useMemo(() => new Set(online.map((c) => c.id)), [online]);

  return (
    <aside className={`flex flex-col border border-border bg-background ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <span className="label">OASIS CHAT</span>
        <span className="label" data-no-translate>
          {online.length + 1} IN THE OASIS
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <span className="flex items-center gap-1 font-mono text-[10px]">
          <span
            className="inline-block size-2 animate-pulse"
            style={{ background: selfId ? colorForVisitor(selfId) : undefined }}
            aria-hidden
          />
          {editingHandle ? (
            <input
              autoFocus
              value={handle}
              maxLength={20}
              onChange={(e) => setHandle(e.target.value)}
              onBlur={() => {
                const clean = handle.trim() || defaultHandle(selfId || mapVisitorId());
                setHandle(clean);
                setMapHandle(clean);
                setEditingHandle(false);
              }}
              aria-label="Your map handle"
              className="w-28 border border-bitcoin bg-background px-1 font-mono text-[10px] uppercase text-foreground outline-none"
            />
          ) : (
            <button
              type="button"
              className="uppercase text-foreground hover:text-bitcoin"
              onClick={() => setEditingHandle(true)}
              data-no-translate
            >
              {handle} [ EDIT ]
            </button>
          )}
        </span>
        {online.map((c) => (
          <span key={c.id} className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
            <span className="inline-block size-2" style={{ background: c.color }} aria-hidden />
            <span data-no-translate>
              {c.handle} · {c.height}
            </span>
          </span>
        ))}
      </div>

      <div ref={listRef} className={`flex-1 divide-y divide-border overflow-y-auto ${listClassName ?? "min-h-[220px] md:max-h-[52vh]"}`}>
        {list.length === 0 ? (
          <p className="px-4 py-6 font-mono text-xs text-muted-foreground">
            &gt; {messages.isLoading ? "OPENING THE ROOM…" : "NOBODY HAS SPOKEN IN THE OASIS YET — SAY SOMETHING"}
            <span className="blink">_</span>
          </p>
        ) : (
          list.map((m) => {
            const color = m.visitorId ? colorForVisitor(m.visitorId) : "hsl(0 0% 55%)";
            const isOnline = !!m.visitorId && (onlineIds.has(m.visitorId) || m.visitorId === selfId);
            const name = m.handle ?? (m.senderAddress ? shortenAddress(m.senderAddress) : "ANON VISITOR");
            return (
              <div key={m.id} className="px-4 py-2.5">
                <p className="label flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-block size-2 ${isOnline ? "animate-pulse" : "opacity-40"}`}
                    style={{ background: color }}
                    aria-hidden
                  />
                  {m.senderAddress ? (
                    <Link
                      to="/profile/$address"
                      params={{ address: m.senderAddress }}
                      className="text-foreground underline decoration-border underline-offset-4 hover:text-bitcoin"
                      data-no-translate
                    >
                      {name.toUpperCase()}
                    </Link>
                  ) : (
                    <span className="text-foreground" data-no-translate>
                      {name.toUpperCase()}
                    </span>
                  )}
                  {m.districtHeight !== null && (
                    <Link
                      to="/bitmap/$block"
                      params={{ block: String(m.districtHeight) }}
                      className="text-bitcoin"
                      data-no-translate
                    >
                      {m.districtHeight}.bitmap
                    </Link>
                  )}
                  <span data-no-translate>{timeAgo(m.createdAt)}</span>
                  {!!user && !!m.visitorId && m.visitorId === selfId && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-bitcoin"
                      onClick={() => remove.mutate(m.id)}
                    >
                      [ DELETE ]
                    </button>
                  )}
                </p>
                <p className="mt-1 break-words font-mono text-sm whitespace-pre-wrap text-foreground">
                  {m.body}
                </p>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-border px-4 py-3">
        {user ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) send.mutate();
            }}
          >
            <textarea
              value={draft}
              maxLength={MAP_CHAT_MAX_LENGTH}
              rows={1}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (draft.trim()) send.mutate();
                }
              }}
              placeholder="SAY SOMETHING… (ENTER TO SEND)"
              aria-label="Map chat message"
              className="w-full resize-none border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-bitcoin"
            />
            <button className="btn-term disabled:opacity-30" disabled={send.isPending || !draft.trim()}>
              {send.isPending ? "[ SENDING… ]" : "[ SEND ]"}
            </button>
          </form>
        ) : (
          <p className="font-mono text-xs text-muted-foreground">
            &gt; SIGN IN TO JOIN THE OASIS CHAT —{" "}
            <Link to="/auth" className="underline decoration-border underline-offset-4 hover:text-foreground">
              [ SIGN IN ]
            </Link>
          </p>
        )}
        {user && address && (
          <p className="label mt-2" data-no-translate>
            POSTING AS {handle} · {shortenAddress(address)}
          </p>
        )}
      </div>
    </aside>
  );
}
