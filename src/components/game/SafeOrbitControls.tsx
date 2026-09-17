import { createElement, type ComponentProps } from "react";
import { OrbitControls } from "@react-three/drei";

/**
 * Orbit controls that discard DOM-only source tags before drei forwards its
 * remaining props to an R3F primitive.
 */
export function SafeOrbitControls(props: ComponentProps<typeof OrbitControls>) {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
    if (key.startsWith("data-")) continue;
    safe[key] = value;
  }
  return createElement(OrbitControls, safe as ComponentProps<typeof OrbitControls>);
}