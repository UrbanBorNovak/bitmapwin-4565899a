import { useState } from "react";
import type { RunningExtender } from "@/lib/use-extender-runtimes";

/** Live quest board and runtime log for the extenders around the player. */
export function ExtenderHud({ running }: { running: RunningExtender[] }) {
  const [open, setOpen] = useState(true);
  if (running.length === 0) return null;

  const quests = running.flatMap((item) =>
    item.snapshot.quests.map((quest) => ({ ...quest, from: item.deployment.name })),
  );
  const logs = running
    .flatMap((item) => item.snapshot.logs.map((line) => `${item.deployment.slug || "ext"}: ${line}`))
    .slice(-6);

  return (
    <div className="pointer-events-auto w-[min(19rem,80vw)] border border-border bg-background/90 font-mono text-[10px] backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between border-b border-border px-2 py-1 text-bitcoin"
      >
        <span>RUNNING EXTENDERS · {running.length}</span>
        <span>{open ? "[ − ]" : "[ + ]"}</span>
      </button>
      {open ? (
        <div className="max-h-64 space-y-2 overflow-y-auto p-2">
          {running.map((item) => (
            <div key={item.deployment.deploymentId} className="space-y-1">
              <div className="flex justify-between gap-2 text-foreground">
                <span data-no-translate className="truncate">
                  {item.deployment.name}
                </span>
                <span data-no-translate className="text-muted-foreground">
                  {item.deployment.height} · v{item.deployment.semver}
                </span>
              </div>
              {item.error ? (
                <p data-no-translate className="text-destructive">
                  {item.error}
                </p>
              ) : (
                <p className="text-muted-foreground">
                  {item.snapshot.props.length} OBJECTS LIVE
                </p>
              )}
            </div>
          ))}

          {quests.length > 0 ? (
            <div className="space-y-1 border-t border-border pt-2">
              <p className="text-bitcoin">QUESTS</p>
              {quests.map((quest) => (
                <div key={`${quest.from}-${quest.id}`}>
                  <p data-no-translate className="text-foreground">
                    [{quest.state.toUpperCase()}] {quest.title}
                  </p>
                  {quest.detail ? (
                    <p data-no-translate className="text-muted-foreground">
                      {quest.detail}
                    </p>
                  ) : null}
                  {quest.reward ? (
                    <p data-no-translate className="text-muted-foreground">
                      REWARD: {quest.reward}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {logs.length > 0 ? (
            <div className="space-y-0.5 border-t border-border pt-2 text-muted-foreground">
              {logs.map((line, index) => (
                <p key={`${index}-${line}`} data-no-translate className="truncate">
                  {line}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
