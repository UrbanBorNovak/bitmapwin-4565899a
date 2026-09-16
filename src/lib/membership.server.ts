/**
 * MEMBERSHIP SETTLEMENT — issues the donation invoice and confirms payment.
 *
 * Each address gets its own invoice amount: 10,000 sats plus a small unique
 * remainder. That remainder is what lets the backend tell one donation from
 * another on a shared address, so a badge only appears once a matching payment
 * really is on the chain.
 */

import { MEMBERSHIP_ADDRESS, MEMBERSHIP_DAYS, MEMBERSHIP_SATS } from "./membership";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type MembershipInvoice = {
  address: string;
  payTo: string;
  invoiceSats: number;
  status: "pending" | "active";
  expiresAt: string | null;
  txid: string | null;
};

type Row = {
  address: string;
  status: string;
  invoice_sats: number;
  expires_at: string | null;
  txid: string | null;
};

function toInvoice(row: Row): MembershipInvoice {
  return {
    address: row.address,
    payTo: MEMBERSHIP_ADDRESS,
    invoiceSats: Number(row.invoice_sats),
    status: row.status === "active" ? "active" : "pending",
    expiresAt: row.expires_at,
    txid: row.txid,
  };
}

const COLUMNS = "address, status, invoice_sats, expires_at, txid";

/** The address's row, creating a fresh invoice the first time. */
export async function startMembership(
  address: string,
  userId: string,
): Promise<MembershipInvoice> {
  const db = await admin();
  const existing = await db.from("memberships").select(COLUMNS).eq("address", address).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return toInvoice(existing.data as Row);

  // A handful of unique sats on top of the donation identifies this payer.
  for (let attempt = 0; attempt < 12; attempt++) {
    const invoiceSats = MEMBERSHIP_SATS + Math.floor(Math.random() * 900) + 1;
    const created = await db
      .from("memberships")
      .insert({ address, user_id: userId, status: "pending", invoice_sats: invoiceSats })
      .select(COLUMNS)
      .maybeSingle();
    if (created.data) return toInvoice(created.data as Row);
  }
  throw new Error("Could not issue a donation amount — try again");
}

type MempoolVout = { scriptpubkey_address?: string; value?: number };
type MempoolTx = {
  txid: string;
  status?: { confirmed?: boolean; block_time?: number };
  vout?: MempoolVout[];
};

async function donationTxs(): Promise<MempoolTx[]> {
  const res = await fetch(`https://mempool.space/api/address/${MEMBERSHIP_ADDRESS}/txs`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error("Could not reach the Bitcoin network right now");
  return (await res.json()) as MempoolTx[];
}

/** Looks for the invoice payment on chain and turns the badge on when it lands. */
export async function checkMembership(
  address: string,
  userId: string,
): Promise<MembershipInvoice & { justActivated: boolean }> {
  const invoice = await startMembership(address, userId);
  const now = Date.now();
  const stillGood =
    invoice.status === "active" &&
    invoice.expiresAt !== null &&
    new Date(invoice.expiresAt).getTime() > now;
  if (stillGood) return { ...invoice, justActivated: false };

  const txs = await donationTxs();
  const match = txs.find((tx) =>
    (tx.vout ?? []).some(
      (out) =>
        out.scriptpubkey_address === MEMBERSHIP_ADDRESS &&
        Number(out.value ?? 0) === invoice.invoiceSats,
    ),
  );
  if (!match) return { ...invoice, justActivated: false };

  const paidAt = match.status?.block_time ? match.status.block_time * 1000 : now;
  const expiresAt = new Date(paidAt + MEMBERSHIP_DAYS * 86_400_000).toISOString();
  const db = await admin();
  const updated = await db
    .from("memberships")
    .update({
      status: "active",
      txid: match.txid,
      paid_at: new Date(paidAt).toISOString(),
      expires_at: expiresAt,
    })
    .eq("address", address)
    .select(COLUMNS)
    .maybeSingle();
  if (updated.error) throw new Error(updated.error.message);
  return {
    ...toInvoice((updated.data ?? {
      address,
      status: "active",
      invoice_sats: invoice.invoiceSats,
      expires_at: expiresAt,
      txid: match.txid,
    }) as Row),
    justActivated: true,
  };
}
