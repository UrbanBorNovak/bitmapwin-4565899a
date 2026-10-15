import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectInscribedWorld, normalizeWorldId } from "@/lib/inscribed-world";

const UPLOAD = "/mnt/user-uploads/My_World_pasted.html";

describe("inscribed world detection", () => {
  it.runIf(existsSync(UPLOAD))("recognises the Inscribed.space 'My World' inscription", () => {
    const w = detectInscribedWorld(readFileSync(UPLOAD, "utf8"));
    expect(w?.engine).toBe("inscribed.space");
    expect(w?.title).toBe("My World");
    expect(w?.backgroundId).toBe("6ef0c153275f961e015e00a0ac02999920b34de9d632a9d4211adb4b44e8979di0");
  });

  it("ignores a plain HTML page", () => {
    expect(detectInscribedWorld("<html><head><title>x</title></head><body><p>hello world</p></body></html>")).toBeNull();
  });

  it("pulls the id out of an ordinals URL", () => {
    const id = "f6b07baf511942564b24dc1816ae9a1ca69e91ceb39a47ccbd27fb05b97ea48bi0";
    expect(normalizeWorldId(`https://ordinals.com/inscription/${id}`)).toBe(id);
    expect(normalizeWorldId("nope")).toBeNull();
  });
});
