import { createElement, type ComponentProps } from "react";
import { Environment } from "@react-three/drei";

/**
 * <Environment> that ignores dev-time source tags.
 *
 * drei's Environment forwards its remaining props to the portal container that
 * React reconciles inside the R3F scene (handleContainerEffects -> applyProps).
 * The source tagger's `data-tsd-source` attribute therefore reaches applyProps,
 * which pierces dashed keys and throws — blanking the whole canvas. Written with
 * createElement so nothing tags this element in turn.
 */
export function SafeEnvironment(props: ComponentProps<typeof Environment>) {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
    if (key.startsWith("data-")) continue;
    safe[key] = value;
  }
  return createElement(Environment, safe as ComponentProps<typeof Environment>);
}
