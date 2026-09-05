import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { codeFromManifest } from "@/lib/extender-sdk";

/**
 * Live deployments that actually carry executable code. Public reads only —
 * anyone standing in the world runs the same published version the deployer
 * chose, and a deployment whose version has no code simply does not appear.
 */

export type RuntimeDeployment = {
  deploymentId: string;
  extenderId: string;
  slug: string;
  name: string;
  category: string;
  semver: string;
  height: number;
  code: string;
  config: Record<string, unknown>;
};

type Row = {
  id: string;
  extender_id: string;
  bitmap_height: number;
  config: unknown;
  extenders: { name: string; slug: string; category: string } | null;
  extender_versions: { semver: string; manifest: unknown } | null;
};

export const runtimeDeploymentsQuery = (limit = 400) =>
  queryOptions({
    queryKey: ["runtime-deployments", limit],
    queryFn: async (): Promise<RuntimeDeployment[]> => {
      const { data, error } = await supabase
        .from("extender_deployments")
        .select(
          "id, extender_id, bitmap_height, config, extenders(name, slug, category), extender_versions(semver, manifest)",
        )
        .eq("status", "active")
        .order("active_from", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const out: RuntimeDeployment[] = [];
      for (const row of (data ?? []) as Row[]) {
        const code = codeFromManifest(row.extender_versions?.manifest);
        if (!code) continue;
        out.push({
          deploymentId: row.id,
          extenderId: row.extender_id,
          slug: row.extenders?.slug ?? "",
          name: row.extenders?.name ?? "EXTENDER",
          category: row.extenders?.category ?? "world-systems",
          semver: row.extender_versions?.semver ?? "—",
          height: Number(row.bitmap_height),
          code,
          config:
            row.config && typeof row.config === "object" ? (row.config as Record<string, unknown>) : {},
        });
      }
      return out;
    },
    staleTime: 60_000,
  });
