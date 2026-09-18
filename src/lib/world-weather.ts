export type WorldWeather = {
  rain: number;
  cloud: number;
  sun: number;
  windStrength: number;
  windX: number;
  windZ: number;
};

const smooth = (edge0: number, edge1: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** A shared, deterministic 4-minute weather cycle with smooth fronts. */
export function worldWeather(elapsed: number): WorldWeather {
  const phase = (elapsed % 240) / 240;
  const front = smooth(0.28, 0.4, phase) * (1 - smooth(0.72, 0.86, phase));
  const storm = smooth(0.43, 0.53, phase) * (1 - smooth(0.66, 0.75, phase));
  const gust = 0.5 + 0.5 * Math.sin(elapsed * 0.37 + Math.sin(elapsed * 0.09) * 1.8);
  const direction = elapsed * 0.018 + Math.sin(elapsed * 0.013) * 0.55;
  const rain = Math.min(1, front * 0.48 + storm * 0.62);
  const cloud = Math.min(1, front * 0.72 + storm * 0.28);
  return {
    rain,
    cloud,
    sun: Math.max(0.12, 1 - cloud * 0.78 - rain * 0.15),
    windStrength: 0.18 + front * 0.42 + storm * 0.48 + gust * (0.08 + front * 0.15),
    windX: Math.sin(direction),
    windZ: Math.cos(direction),
  };
}