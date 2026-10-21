import { useEffect, useRef, useState } from "react";
/** Height that fills the visible window below the element's top (zoom-aware), so room verb bars stay on screen. */
export function useFitHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    const fit = () => {
      const el = ref.current; if (!el) return;
      const z = Number((document.documentElement.style as CSSStyleDeclaration & { zoom: string }).zoom) || 1;
      const vh = (window.visualViewport?.height ?? window.innerHeight) / z;
      let top = 0; for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
      setH(Math.max(320, Math.floor(vh - top)));
    };
    fit(); window.addEventListener("resize", fit); window.visualViewport?.addEventListener("resize", fit);
    return () => { window.removeEventListener("resize", fit); window.visualViewport?.removeEventListener("resize", fit); };
  }, []);
  return [ref, h] as const;
}
