import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { runRegistryResolveFn } from "@/lib/registry-resolver.functions";

/**
 * Headless driver that keeps the registry resolver pass advancing on every
 * page. The server throttles runs, so ticking often is safe.
 */
export function RegistryResolverDriver() {
  const queryClient = useQueryClient();
  const resolveFn = useServerFn(runRegistryResolveFn);
  const running = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (running.current || document.hidden) return;
      running.current = true;
      try {
        const result = await resolveFn({ data: { batch: 40 } });
        if (cancelled || result.skipped) return;
        await queryClient.invalidateQueries({ queryKey: ["registry-resolve"] });
        if (result.resolved > 0) {
          await queryClient.invalidateQueries({ queryKey: ["trade-crawl"] });
        }
      } catch {
        // The ordinals index throttles sometimes; the next tick retries.
      } finally {
        running.current = false;
      }
    };

    void tick();
    const timer = window.setInterval(tick, 60_000);
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [resolveFn, queryClient]);

  return null;
}
