/**
 * After the dev server restarts, an open page still holds old server-function IDs.
 * The server answers those with 409 + x-stale-server-fn; this reloads the page once
 * (guarded for 30s) so it picks up the fresh bundle instead of showing errors.
 */
const KEY = "bw-stale-serverfn-reload";

export function isStaleServerFnResponse(url: string, res: { status: number; headers: Headers }): boolean {
  return url.includes("/_serverFn/") && res.status === 409 && res.headers.get("x-stale-server-fn") === "1";
}

if (typeof window !== "undefined" && !(window as unknown as { __bwStaleFn?: boolean }).__bwStaleFn) {
  (window as unknown as { __bwStaleFn?: boolean }).__bwStaleFn = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const res = await orig(input, init);
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (isStaleServerFnResponse(url, res)) {
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last > 30_000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
      }
    }
    return res;
  };
}
