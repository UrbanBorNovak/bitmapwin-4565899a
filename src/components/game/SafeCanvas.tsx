import { Component, createElement, useSyncExternalStore, type ReactNode } from "react";
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
 *
 * When the browser cannot start WebGL (disabled, blocklisted driver, too many
 * live contexts) the canvas is replaced by a static panel instead of throwing
 * into the route error screen and blanking the whole page.
 */

// Probed once per page load: each probe creates a real context, and creating
// many would evict live contexts on browsers with a context cap.
let webglProbe: boolean | null = null;
function probeWebGL(): boolean {
  if (webglProbe !== null) return webglProbe;
  try {
    const c = document.createElement("canvas");
    // three r163+ renders through WebGL2 only.
    const ctx = c.getContext("webgl2") as WebGL2RenderingContext | null;
    webglProbe = Boolean(ctx);
    ctx?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglProbe = false;
  }
  return webglProbe;
}
const noopSubscribe = () => () => {};
const serverSnapshot = () => true;

export function isWebGLStartupError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /webgl|creating .*context|context could not be created/i.test(msg);
}

function NoWebGLPanel({ className, style, children }: { className?: string; style?: CanvasProps["style"]; children?: ReactNode }) {
  return (
    <div
      role="img"
      aria-label="3D view unavailable"
      className={`flex h-full w-full items-center justify-center bg-background/60 ${className ?? ""}`}
      style={style}
    >
      {children ?? (
        <span className="px-3 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
          3D view unavailable on this device
        </span>
      )}
    </div>
  );
}

type GuardProps = { fallback: ReactNode; children: ReactNode };
/** Catches only WebGL startup failures; every other error still reaches the
 *  surrounding boundary unchanged. */
class WebGLGuard extends Component<GuardProps, { error: unknown; failed: boolean }> {
  state = { error: null as unknown, failed: false };
  static getDerivedStateFromError(error: unknown) {
    return { error, failed: true };
  }
  render() {
    if (this.state.failed) {
      if (!isWebGLStartupError(this.state.error)) throw this.state.error;
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export function SafeCanvas(props: CanvasProps) {
  const supported = useSyncExternalStore(noopSubscribe, probeWebGL, serverSnapshot);
  const fallback = <NoWebGLPanel className={props.className} style={props.style}>{props.fallback}</NoWebGLPanel>;
  if (!supported) return fallback;

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
    if (key.startsWith("data-")) continue;
    safe[key] = value;
  }
  // The site's page-size preference sets CSS zoom on <html>. Bounding rects are
  // zoomed but canvas styles are not, so measuring by rect makes the canvas
  // grow by the zoom factor every resize until the GPU gives up. Layout
  // (offset) sizes are unzoomed and stable.
  safe["resize"] = { offsetSize: true, ...(props.resize ?? {}) };
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
        const live = state.get();
        const { width, height } = live.size;
        if (!width || !height) return;
        const dpr = live.viewport.dpr;
        const cap = Math.min(limit / (width * dpr), limit / (height * dpr), 1);
        if (cap < 1) state.setDpr(Math.max(0.5, dpr * cap * 0.98));
      };
      fit();
      window.addEventListener("resize", () => setTimeout(fit, 50));
    } catch {
      // Older contexts without these parameters keep the default size.
    }
    userCreated?.(state);
  };
  return <WebGLGuard fallback={fallback}>{createElement(Canvas, safe as CanvasProps)}</WebGLGuard>;
}
