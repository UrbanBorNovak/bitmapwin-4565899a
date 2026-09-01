import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";

/** Bitcoin addresses cryptographically linked to the signed-in account. */
export async function myAddresses(ctx: ToolContext): Promise<string[]> {
  const supabase = supabaseForUser(ctx);
  const { data, error } = await supabase
    .from("wallet_links")
    .select("address")
    .eq("user_id", ctx.getUserId() ?? "");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.address);
}

export function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function errorResult(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}
