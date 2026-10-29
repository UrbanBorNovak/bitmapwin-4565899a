import { expect, test } from "vitest";
import { packetText, readPacket } from "@/lib/toon-ai-packet";
import { generateEpisode } from "@/lib/toon-script";
test("round trip", () => { const r = readPacket("```json\n"+packetText(generateEpisode(840000, 77819))+"\n```"); expect("episode" in r).toBe(true); });
test("bad fx", () => { const p = JSON.parse(packetText(generateEpisode(840000, 77819))); p.episode.scenes[0].fx=[{id:"nope",at:0}]; p.episode.scenes[0].shot="zoom"; const r = readPacket(JSON.stringify(p)); expect("errors" in r && r.errors.length).toBe(2); });
