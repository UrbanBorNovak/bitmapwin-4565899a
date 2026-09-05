/**
 * Every surface in the bedrock labels the provenance of what it shows, so a
 * human or an agent can tell real state from a boundary that is not built yet.
 */
export function DataBadge({ kind, note }: { kind: "live" | "mock" | "soon"; note?: string }) {
  const label = kind === "live" ? "LIVE DATA" : kind === "mock" ? "MOCK DATA" : "COMING SOON";
  const tone =
    kind === "live"
      ? "border-bitcoin text-bitcoin"
      : kind === "soon"
        ? "border-border text-muted-foreground"
        : "border-border-strong text-foreground";
  return (
    <span className={`label inline-flex items-center gap-1 border px-1.5 py-0.5 ${tone}`}>
      {label}
      {note ? <span className="text-muted-foreground">· {note}</span> : null}
    </span>
  );
}
