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

const PUBLIC_DEPLOYMENT_PAGE_SIZE = 500;

type Row = {
  id: string;
  extender_id: string;
  bitmap_height: number;
  config: unknown;
  extenders: { name: string; slug: string; category: string } | null;
  extender_versions: { semver: string; manifest: unknown } | null;
};

function toRuntimeDeployment(row: Row): RuntimeDeployment | null {
  const code = codeFromManifest(row.extender_versions?.manifest);
  if (!code) return null;
  return {
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
  };
}

export async function fetchRuntimeDeployments(): Promise<RuntimeDeployment[]> {
  const out: RuntimeDeployment[] = [];
  for (let from = 0; ; from += PUBLIC_DEPLOYMENT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("extender_deployments")
      .select(
        "id, extender_id, bitmap_height, config, extenders(name, slug, category), extender_versions(semver, manifest)",
      )
      .eq("status", "active")
      .order("active_from", { ascending: false })
      .range(from, from + PUBLIC_DEPLOYMENT_PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of (data ?? []) as Row[]) {
      const deployment = toRuntimeDeployment(row);
      if (deployment) out.push(deployment);
    }
    if ((data ?? []).length < PUBLIC_DEPLOYMENT_PAGE_SIZE) break;
  }
  return out;
}

export const runtimeDeploymentsQuery = () =>
  queryOptions({
    queryKey: ["runtime-deployments", "all"],
    queryFn: fetchRuntimeDeployments,
    staleTime: 60_000,
  });

/** Exact public runtime stack for one BITMAP, including executable published code. */
export const runtimeDeploymentsForHeightQuery = (height: number) =>
  queryOptions({
    queryKey: ["runtime-deployments", "height", height],
    queryFn: async (): Promise<RuntimeDeployment[]> => {
      const { data, error } = await supabase
        .from("extender_deployments")
        .select(
          "id, extender_id, bitmap_height, config, extenders(name, slug, category), extender_versions(semver, manifest)",
        )
        .eq("bitmap_height", height)
        .eq("status", "active")
        .order("active_from", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Row[])
        .map(toRuntimeDeployment)
        .filter((deployment): deployment is RuntimeDeployment => deployment !== null);
    },
    staleTime: 30_000,
  });
