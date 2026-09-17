import { createElement } from "react";
import { Canvas, type CanvasProps } from "@react-three/fiber";

/**
 * <Canvas> that ignores dev-time source tags.
 *
 * The JSX source tagger injects a `data-tsd-source` attribute onto JSX
 * elements. R3F forwards unknown Canvas props onto the root scene state and
 * pierces dashed keys, so `data-tsd-source` throws and blanks the whole canvas.
 * Written with createElement so nothing tags this element in turn.
 */
export function SafeCanvas(props: CanvasProps) {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
    if (key.startsWith("data-")) continue;
    safe[key] = value;
  }
  return createElement(Canvas, safe as CanvasProps);
}
