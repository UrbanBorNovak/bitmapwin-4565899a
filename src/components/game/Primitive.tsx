import { createElement } from "react";

/**
 * Renders an existing three.js object into the scene graph.
 *
 * Written with createElement instead of JSX on purpose: the dev-time JSX source
 * tagger injects a `data-tsd-source` attribute into JSX elements, and R3F's
 * <primitive> forwards every prop straight onto the wrapped object, where that
 * dashed attribute throws and blanks the canvas.
 */
export function Primitive(props: { object: object; attach?: string }) {
  return createElement("primitive", props);
}
