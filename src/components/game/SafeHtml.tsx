import { createElement, type ComponentProps } from "react";
import { Html } from "@react-three/drei";

/**
 * <Html> that ignores dev-time source tags.
 *
 * drei's Html spreads every prop onto an inner <group>, so the source tagger's
 * `data-tsd-source` attribute reaches R3F's applyProps, which pierces dashed
 * keys and throws — blanking the whole canvas. Written with createElement so
 * nothing tags this element in turn.
 */
export function SafeHtml(props: ComponentProps<typeof Html>) {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
    if (key.startsWith("data-")) continue;
    safe[key] = value;
  }
  return createElement(Html, safe as ComponentProps<typeof Html>);
}
