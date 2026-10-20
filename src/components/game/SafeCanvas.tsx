import { createElement } from "react";
import { Canvas, type CanvasProps } from "@react-three/fiber";

/**
 * <Canvas> that ignores dev-time source tags.
 *
 * The JSX source tagger injects a `data-tsd-source` attribute onto JSX
 * elements. R3F forwards unknown Canvas props onto the root scene state and
 * pierces dashed keys, so `data-tsd-source` throws and blanks the whole canvas.
 * Also lets a lost WebGL context be restored instead of leaving a blank stage,
 * and keeps the drawing buffer within the GPU's renderbuffer limits so large or
 * high-DPI screens never get an incomplete (zero-size) framebuffer.
 */
export function SafeCanvas(props: CanvasProps) {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
    if (key.startsWith("data-")) continue;
    safe[key] = value;
  }
  const userCreated = props.onCreated;
  safe["onCreated"] = (state: Parameters<NonNullable<CanvasProps["onCreated"]>>[0]) => {
    const el = state.gl.domElement;
    el.addEventListener("webglcontextlost", (e) => e.preventDefault(), false);
    try {
      const ctx = state.gl.getContext();
      const maxRb = Number(ctx.getParameter(ctx.MAX_RENDERBUFFER_SIZE)) || 4096;
      const dims = ctx.getParameter(ctx.MAX_VIEWPORT_DIMS) as Int32Array | null;
      // Stay well under the hard limit: MSAA buffers also count toward VRAM.
      const limit = Math.min(maxRb, dims?.[0] ?? maxRb, dims?.[1] ?? maxRb, 4096);
      const fit = () => {
        const { width, height } = state.size;
        if (!width || !height) return;
        const dpr = state.viewport.dpr;
        const cap = Math.min(limit / (width * dpr), limit / (height * dpr), 1);
        if (cap < 1) state.setDpr(Math.max(0.5, dpr * cap * 0.98));
      };
      fit();
      state.events.connected; // no-op: keep state referenced
      window.addEventListener("resize", () => setTimeout(fit, 50));
    } catch {
      // Older contexts without these parameters keep the default size.
    }
    userCreated?.(state);
  };
  return createElement(Canvas, safe as CanvasProps);
}
