import { createElement, type ComponentProps } from "react";
import { Lightformer } from "@react-three/drei";

/**
 * <Lightformer> that ignores dev-time source tags.
 *
 * drei's Lightformer spreads every remaining prop onto an inner <mesh> that
 * lives inside the <Environment> portal, so the source tagger's
 * `data-tsd-source` attribute reaches R3F's applyProps, which pierces dashed
 * keys and throws — blanking the whole canvas. Written with createElement so
 * nothing tags this element in turn.
 */
export function SafeLightformer(props: ComponentProps<typeof Lightformer>) {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
    if (key.startsWith("data-")) continue;
    safe[key] = value;
  }
  return createElement(Lightformer, safe as ComponentProps<typeof Lightformer>);
}
