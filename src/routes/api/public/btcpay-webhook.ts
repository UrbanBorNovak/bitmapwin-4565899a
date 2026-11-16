import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

async function hmacHex(secret: string, body: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** BTCPay webhook: signature-checked, then the invoice is re-read from BTCPay before any booking. */
export const Route = createFileRoute("/api/public/btcpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["BTCPAY_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });
        const body = await request.text();
        const sig = (request.headers.get("btcpay-sig") ?? "").replace(/^sha256=/, "");
        if (!safeEq(sig, await hmacHex(secret, body))) return new Response("Invalid signature", { status: 401 });
        const p = z.object({ type: z.string(), invoiceId: z.string().max(64).optional() }).safeParse(JSON.parse(body));
        if (!p.success || !p.data.invoiceId || !/Settled/.test(p.data.type)) return new Response("ignored");
        const { btcpayConfig, activateSettledInvoice } = await import("@/lib/btcpay.server");
        const c = btcpayConfig();
        if (!c) return new Response("Not configured", { status: 503 });
        try { await activateSettledInvoice(c, p.data.invoiceId); } catch { return new Response("retry", { status: 500 }); }
        return new Response("ok");
      },
    },
  },
});
