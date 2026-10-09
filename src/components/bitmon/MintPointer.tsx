import { Link } from "@tanstack/react-router";

/** Flashy frontpage pointer to the Guardian mint. */
export function MintPointer() {
  return (
    <Link
      to="/mint"
      className="group relative mt-4 flex items-center justify-between gap-3 overflow-hidden border border-bitcoin bg-background px-4 py-3 shadow-[0_0_24px_-6px_var(--color-bitcoin)] transition hover:shadow-[0_0_40px_-4px_var(--color-bitcoin)]"
    >
      <span className="mint-sweep pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-bitcoin/25 to-transparent" aria-hidden="true" />
      <span className="relative flex items-center gap-3">
        <span className="relative flex size-3" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping bg-bitcoin opacity-75" />
          <span className="relative inline-flex size-3 bg-bitcoin" />
        </span>
        <span>
          <span className="label block text-signal">MINT LIVE // DMT GUARDIANS</span>
          <span className="display block text-base text-bitcoin sm:text-lg">SUMMON YOUR GUARDIAN</span>
        </span>
      </span>
      <span className="relative font-mono text-sm font-bold text-bitcoin transition-transform group-hover:translate-x-1 animate-pulse">
        MINT NOW →
      </span>
    </Link>
  );
}
