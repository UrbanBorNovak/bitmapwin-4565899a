import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { InscriptionAvatar } from "@/components/InscriptionAvatar";
import { supabase } from "@/integrations/supabase/client";
import { accountLabel, useAuthSession } from "@/lib/auth";
import { timeAgo } from "@/lib/bitmap";
import {
  CHAT_MAX_LENGTH,
  bitmapChatQuery,
  deleteBitmapChatMessage,
  sendBitmapChatMessage,
} from "@/lib/bitmap-chat";
import { profilesQuery } from "@/lib/profiles";
import { shortenAddress } from "@/lib/registry";
import { useWalletSession } from "@/lib/wallet-session";

/** Live public chat room for everyone currently standing on this bitmap. */
export function BitmapChat({ height }: { height: number }) {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();
  const wallet = useWalletSession();
  const address = wallet?.ordinalsAddress ?? null;
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const messages = useQuery(bitmapChatQuery(height));
  const addresses = useMemo(
    () =>
      Array.from(
        new Set((messages.data ?? []).flatMap((m) => (m.senderAddress ? [m.senderAddress] : []))),
      ),
    [messages.data],
  );
  const profiles = useQuery(profilesQuery(addresses));

  useEffect(() => {
    const channel = supabase
      .channel(`bitmap-chat-${height}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bitmap_chat_messages", filter: `bitmap_height=eq.${height}` },
        () => queryClient.invalidateQueries({ queryKey: ["bitmap-chat", height] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [height, queryClient]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.data]);

  const send = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("SIGN IN TO CHAT");
      await sendBitmapChatMessage({ height, userId: user.id, senderAddress: address, body: draft });
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["bitmap-chat", height] });
    },
    onError: (e) => toast("MESSAGE NOT SENT", { description: (e as Error).message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBitmapChatMessage(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bitmap-chat", height] }),
    onError: (e) => toast("DELETE FAILED", { description: (e as Error).message }),
  });

  const list = messages.data ?? [];

  return (
    <section className="mt-8 border border-border">
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <span className="label">BITMAP CHAT — {height}.BITMAP</span>
        <span className="label">{list.length} MESSAGE(S)</span>
      </div>

      <div ref={listRef} className="max-h-[380px] overflow-y-auto divide-y divide-border">
        {list.length === 0 ? (
          <p className="px-6 py-6 font-mono text-xs text-muted-foreground">
            &gt; {messages.isLoading ? "OPENING THE ROOM…" : "NO ONE HAS SPOKEN HERE YET — SAY SOMETHING"}
            <span className="blink">_</span>
          </p>
        ) : (
          list.map((m) => {
            const profile = m.senderAddress ? profiles.data?.get(m.senderAddress) : null;
            const name =
              profile?.displayName ??
              (m.senderAddress ? shortenAddress(m.senderAddress) : "ANON VISITOR");
            return (
              <div key={m.id} className="flex gap-3 px-6 py-3">
                <span className="flex size-7 shrink-0 items-center justify-center border border-border bg-surface">
                  <InscriptionAvatar
                    inscriptionId={profile?.avatarInscriptionId}
                    label={name}
                    alt=""
                    className="size-full"
                    fallbackClassName="text-bitcoin"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="label flex flex-wrap items-baseline gap-2">
                    {m.senderAddress ? (
                      <Link
                        to="/profile/$address"
                        params={{ address: m.senderAddress }}
                        className="text-foreground underline decoration-border underline-offset-4 hover:text-bitcoin"
                      >
                        {name.toUpperCase()}
                      </Link>
                    ) : (
                      <span className="text-foreground">{name}</span>
                    )}
                    <span>{timeAgo(m.createdAt)}</span>
                    {user?.id === m.userId && (
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
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-border px-6 py-4">
        {user ? (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) send.mutate();
            }}
          >
            <input
              value={draft}
              maxLength={CHAT_MAX_LENGTH}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`MESSAGE ${height}.BITMAP…`}
              aria-label="Chat message"
              className="min-w-0 flex-1 border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-bitcoin"
            />
            <button className="btn-term disabled:opacity-30" disabled={send.isPending || !draft.trim()}>
              {send.isPending ? "[ SENDING… ]" : "[ SEND ]"}
            </button>
          </form>
        ) : (
          <p className="font-mono text-xs text-muted-foreground">
            &gt; SIGN IN TO JOIN THE CONVERSATION —{" "}
            <Link to="/auth" className="underline decoration-border underline-offset-4 hover:text-foreground">
              [ SIGN IN ]
            </Link>
          </p>
        )}
        {user && !address && (
          <p className="label mt-2">CONNECT A WALLET ON /WALLET TO CHAT UNDER YOUR BITMAP NAME</p>
        )}
        {user && address && (
          <p className="label mt-2">POSTING AS {accountLabel(user)} · {shortenAddress(address)}</p>
        )}
      </div>
    </section>
  );
}
