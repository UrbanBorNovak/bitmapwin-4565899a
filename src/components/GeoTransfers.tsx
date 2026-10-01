import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * GeoTransfers — hairline world-coastline silhouette with animated arcs of
 * BITMAPs travelling between hubs. Routes are illustrative; labels use real
 * recently-sold BITMAP heights when provided.
 */

type P = [number, number];
const LAND: P[][] = [
  [[-168,66],[-140,70],[-110,72],[-80,73],[-62,60],[-55,50],[-66,44],[-76,35],[-81,25],[-90,29],[-97,26],[-97,18],[-87,15],[-83,9],[-79,8],[-92,15],[-105,20],[-112,30],[-118,34],[-124,40],[-125,48],[-135,57],[-150,60],[-165,60]],
  [[-50,60],[-42,60],[-20,70],[-20,80],[-60,82],[-70,77],[-55,70]],
  [[-78,8],[-60,10],[-50,0],[-35,-6],[-40,-22],[-48,-28],[-58,-38],[-65,-55],[-72,-50],[-73,-35],[-70,-18],[-81,-5]],
  [[-10,36],[-9,43],[-2,44],[-5,48],[2,51],[8,54],[10,58],[5,62],[15,69],[28,71],[40,67],[30,60],[40,45],[28,41],[22,36],[15,38],[12,44],[3,42]],
  [[-5,50],[1,51],[-2,56],[-5,58],[-6,54]],
  [[-17,15],[-17,21],[-10,30],[-6,36],[10,37],[20,32],[32,31],[35,25],[43,12],[51,12],[40,-2],[40,-15],[33,-25],[20,-35],[15,-28],[12,-15],[9,0],[3,6],[-8,5]],
  [[28,41],[40,45],[30,60],[40,67],[70,73],[100,78],[140,72],[180,68],[170,60],[155,58],[140,50],[130,42],[122,40],[122,30],[110,20],[108,10],[100,13],[98,8],[95,16],[90,22],[80,15],[77,8],[72,20],[66,25],[56,26],[50,30],[44,13],[35,30],[36,36]],
  [[130,31],[136,34],[141,38],[142,45],[139,40],[133,34]],
  [[114,-22],[122,-18],[131,-12],[137,-12],[142,-11],[146,-19],[153,-28],[150,-37],[140,-38],[132,-32],[115,-34]],
  [[166,-46],[174,-41],[178,-38],[172,-34],[168,-44]],
];

const HUBS: { name: string; lon: number; lat: number }[] = [
  { name: "SAN FRANCISCO", lon: -122, lat: 38 },
  { name: "AUSTIN", lon: -98, lat: 30 },
  { name: "NEW YORK", lon: -74, lat: 41 },
  { name: "SAN SALVADOR", lon: -89, lat: 14 },
  { name: "SÃO PAULO", lon: -47, lat: -24 },
  { name: "REYKJAVIK", lon: -22, lat: 64 },
  { name: "LONDON", lon: 0, lat: 51 },
  { name: "ZURICH", lon: 8, lat: 47 },
  { name: "LJUBLJANA", lon: 14, lat: 46 },
  { name: "LAGOS", lon: 3, lat: 6 },
  { name: "DUBAI", lon: 55, lat: 25 },
  { name: "MUMBAI", lon: 73, lat: 19 },
  { name: "SINGAPORE", lon: 104, lat: 1 },
  { name: "HONG KONG", lon: 114, lat: 22 },
  { name: "TOKYO", lon: 140, lat: 36 },
  { name: "SYDNEY", lon: 151, lat: -34 },
];

type Flight = { a: number; b: number; born: number; dur: number; label: string };

const ORANGE = "oklch(0.72 0.169 55)";

export function GeoTransfers({ className, heights = [] }: { className?: string; heights?: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const heightsRef = useRef(heights);
  heightsRef.current = heights;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const css = getComputedStyle(document.documentElement);
    const signal = css.getPropertyValue("--signal").trim() || "oklch(0.82 0.13 205)";
    let w = 0, h = 0, dpr = 1, scale = 1, oy = 0, ox = 0, raf = 0, next = 0;
    let flights: Flight[] = [];
    let n = 0;

    const proj = (lon: number, lat: number): P => [ox + (lon + 180) * scale, oy + (80 - lat) * scale];

    function resize() {
      const r = canvas!.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width; h = r.height;
      canvas!.width = Math.max(1, Math.floor(w * dpr));
      canvas!.height = Math.max(1, Math.floor(h * dpr));
      scale = Math.min(w / 360, h / 140);
      ox = (w - 360 * scale) / 2;
      oy = (h - 140 * scale) / 2;
    }

    function spawn(now: number) {
      const a = Math.floor(Math.random() * HUBS.length);
      let b = Math.floor(Math.random() * HUBS.length);
      if (b === a) b = (b + 5) % HUBS.length;
      const hs = heightsRef.current;
      const label = hs.length ? `${hs[n++ % hs.length]}.BITMAP → ${HUBS[b]!.name}` : `BITMAP → ${HUBS[b]!.name}`;
      flights.push({ a, b, born: now, dur: 3200 + Math.random() * 1800, label });
    }

    function curve(f: Flight, t: number): P {
      const A = proj(HUBS[f.a]!.lon, HUBS[f.a]!.lat);
      const B = proj(HUBS[f.b]!.lon, HUBS[f.b]!.lat);
      const lift = Math.hypot(B[0] - A[0], B[1] - A[1]) * 0.35;
      const C: P = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - lift];
      const u = 1 - t;
      return [u * u * A[0] + 2 * u * t * C[0] + t * t * B[0], u * u * A[1] + 2 * u * t * C[1] + t * t * B[1]];
    }

    function paint(now: number) {
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, w, h);

      // coastline silhouette
      ctx!.strokeStyle = signal;
      ctx!.lineWidth = 0.8;
      ctx!.globalAlpha = 0.18;
      ctx!.fillStyle = signal;
      for (const poly of LAND) {
        ctx!.beginPath();
        poly.forEach(([lon, lat], i) => {
          const [x, y] = proj(lon, lat);
          if (i) ctx!.lineTo(x, y); else ctx!.moveTo(x, y);
        });
        ctx!.closePath();
        ctx!.globalAlpha = 0.035;
        ctx!.fill();
        ctx!.globalAlpha = 0.2;
        ctx!.stroke();
      }

      // hubs
      HUBS.forEach((hub, i) => {
        const [x, y] = proj(hub.lon, hub.lat);
        const p = reduced ? 0.5 : (now / 2400 + i * 0.31) % 1;
        ctx!.globalAlpha = 0.5;
        ctx!.fillStyle = signal;
        ctx!.fillRect(x - 1.5, y - 1.5, 3, 3);
        ctx!.globalAlpha = (1 - p) * 0.25;
        ctx!.strokeStyle = signal;
        ctx!.beginPath();
        ctx!.arc(x, y, 3 + p * 7, 0, Math.PI * 2);
        ctx!.stroke();
      });

      if (!reduced) {
        if (now >= next) {
          if (flights.length < 4) spawn(now);
          next = now + 1600 + Math.random() * 1800;
        }
        flights = flights.filter((f) => now - f.born < f.dur + 1600);
        ctx!.font = "10px ui-monospace, SFMono-Regular, monospace";
        for (const f of flights) {
          const t = Math.min(1, (now - f.born) / f.dur);
          const fade = t < 1 ? 1 : 1 - (now - f.born - f.dur) / 1600;
          // arc trail
          ctx!.strokeStyle = ORANGE;
          ctx!.lineWidth = 1;
          ctx!.globalAlpha = 0.35 * fade;
          ctx!.beginPath();
          for (let s = 0; s <= 30; s++) {
            const [x, y] = curve(f, (s / 30) * t);
            if (s) ctx!.lineTo(x, y); else ctx!.moveTo(x, y);
          }
          ctx!.stroke();
          if (t < 1) {
            const [x, y] = curve(f, t);
            ctx!.globalAlpha = 1;
            ctx!.fillStyle = ORANGE;
            ctx!.shadowColor = ORANGE;
            ctx!.shadowBlur = 10;
            ctx!.fillRect(x - 3, y - 3, 6, 6);
            ctx!.shadowBlur = 0;
          } else {
            const [x, y] = curve(f, 1);
            const p = 1 - fade;
            ctx!.globalAlpha = fade * 0.6;
            ctx!.strokeStyle = ORANGE;
            ctx!.beginPath();
            ctx!.arc(x, y, 4 + p * 22, 0, Math.PI * 2);
            ctx!.stroke();
            ctx!.globalAlpha = fade * 0.75;
            ctx!.fillStyle = ORANGE;
            ctx!.fillText(f.label, x + 8, y - 6);
          }
        }
      }
      ctx!.globalAlpha = 1;
      raf = requestAnimationFrame(paint);
    }

    resize();
    raf = requestAnimationFrame(paint);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={cn("pointer-events-none absolute inset-0 size-full", className)} />;
}
