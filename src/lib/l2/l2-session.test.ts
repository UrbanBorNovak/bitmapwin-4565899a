import { describe, it, expect } from "vitest";
import { Blowfish } from "./blowfish";
import { appendChecksum, bigToBytes, bytesToBig, encXorPass, GameCrypt, modPow, scrambleModulus, staticLoginCipher, unscrambleModulus, verifyChecksum } from "./l2-crypt";
import { Framer, frame, PacketReader, PacketWriter } from "./l2-packets";
import { L2Session, type SessionEvent, type SocketLike } from "./l2-session";

const N = 0xbf8a462e6dc40dd3f3cd4193f722f4008b6dce8be788abae8b655e4c72a87d92c1607fc6905b664e7d40752630e671fda29abac9d82ff541ca5b72150ecea053ed13edfa39fb27e35f35c23a0226da26541c978d26b06ab135f6ec63f3a3e8a028d51a2741b11ff43676f49ed728a88138c7614cc29d7383d6553434db1ce9f3n, D = 0x8bacdad6daa6a06ad29bf8595d5bf8d138dbdf45f8969a9393055dc9a3c728a34f2efe9e9f0077cf7ed8f554df4dfd0c377a5c01fb0ba5eecf10f65552d1ece963c0e6f6740b725c5aeb88a0fb5cb900a9e950b595d23a50141d8d579828b8efc4f6266f11f0bfa79d079f33d8704e6cf931b13842f279d74ab20126dd8e04e9n;

describe("L2 crypto", () => {
  it("matches the standard Blowfish test vector", () => {
    expect(new Blowfish(new Uint8Array(8)).enc(0, 0)).toEqual([0x4ef99745, 0x6198dd78]);
  });
  it("round-trips the RSA key scramble and checksum", () => {
    const m = bigToBytes(N, 128);
    expect(unscrambleModulus(scrambleModulus(m))).toEqual(m);
    const raw = new Uint8Array(16); raw.set([1, 2, 3, 4, 5]); appendChecksum(raw);
    expect(verifyChecksum(raw)).toBe(true); raw[2] = raw[2]! ^ 1; expect(verifyChecksum(raw)).toBe(false);
  });
  it("reassembles split and merged packets", () => {
    const f = new Framer(); const a = frame(Uint8Array.of(1, 2, 3)), b = frame(Uint8Array.of(9));
    const all = new Uint8Array([...a, ...b]);
    expect(f.push(all.slice(0, 2))).toEqual([]);
    expect(f.push(all.slice(2))).toEqual([Uint8Array.of(1, 2, 3), Uint8Array.of(9)]);
  });
});

/** A tiny stand-in for an L2J login + game server, speaking the real byte format. */
function fakeServer(opts: { password: string; failLogin?: boolean; rejectProtocol?: boolean; closeOnEnter?: boolean }) {
  const dyn = new Blowfish(Uint8Array.from({ length: 16 }, (_, i) => i * 7 + 1));
  const seen: string[] = [];
  const sealLogin = (body: Uint8Array) => { const raw = new Uint8Array(Math.ceil((body.length + 4) / 8) * 8); raw.set(body); appendChecksum(raw); dyn.encryptL2(raw); return frame(raw); };
  const makeSocket = (url: string): SocketLike => {
    const game = url.includes("7778");
    let gc: GameCrypt | null = null;
    const framer = new Framer();
    const sock: SocketLike = {
      binaryType: "", onopen: null, onmessage: null, onerror: null, onclose: null,
      close() {},
      send(d) {
        for (const p of framer.push(d)) {
          if (!game) {
            dyn.decryptL2(p); expect(verifyChecksum(p)).toBe(true);
            const op = p[0]!; seen.push(`login:${op}`);
            if (op === 0x07) reply(sealLogin(new PacketWriter().u8(0x0b).i32(42).done()));
            if (op === 0x00) {
              const block = bigToBytes(modPow(bytesToBig(p.slice(1, 129)), D, N), 128);
              const user = String.fromCharCode(...block.slice(0x5e, 0x6c)).replace(/\0+$/, "");
              const pass = String.fromCharCode(...block.slice(0x6c, 0x7c)).replace(/\0+$/, "");
              seen.push(`auth:${user}`);
              if (opts.failLogin || pass !== opts.password) reply(sealLogin(new PacketWriter().u8(0x01).i32(0x03).done()));
              else reply(sealLogin(new PacketWriter().u8(0x03).i32(111).i32(222).done()));
            }
            if (op === 0x05) {
              const w = new PacketWriter().u8(0x04).u8(1).u8(1).u8(1).u8(127).u8(0).u8(0).u8(1).i32(7777).u8(0).u8(0).u16(3).u16(500).u8(1).i32(1).u8(0);
              reply(sealLogin(w.done()));
            }
            if (op === 0x02) reply(sealLogin(new PacketWriter().u8(0x07).i32(333).i32(444).done()));
          } else if (!gc) {
            expect(new PacketReader(p, 1).i32()).toBe(746);
            const key = Uint8Array.of(9, 8, 7, 6, 5, 4, 3, 2);
            reply(frame(new PacketWriter().u8(0).u8(opts.rejectProtocol ? 0 : 1).bytes(key).i32(1).i32(1).done()));
            gc = new GameCrypt(key);
          } else {
            gc.decrypt(p); const r = new PacketReader(p, 1);
            if (p[0] === 0x08) {
              seen.push(`game-auth:${r.str()}:${r.i32()}:${r.i32()}:${r.i32()}:${r.i32()}`);
              const w = new PacketWriter().u8(0x13).i32(2);
              for (const [name, lvl, cls] of [["Aria", 20, 11], ["Bob", 52, 2]] as const) {
                w.str(name).i32(1000 + lvl).str("tester").i32(1).i32(0).i32(0).i32(1).i32(0).i32(0).i32(1).i32(10).i32(20).i32(-30);
                w.bytes(new Uint8Array(16)).i32(0).bytes(new Uint8Array(8)).i32(lvl).i32(0).bytes(new Uint8Array(4 * 9 + 4 * 34 + 12 + 16));
                w.i32(0).i32(cls).i32(1).u8(0).i32(0);
              }
              const out = w.done(); gc.encrypt(out); reply(frame(out));
            }
            if (p[0] === 0x0d) {
              seen.push(`select:${r.i32()}`);
              const w = new PacketWriter().u8(0x15).str("Bob").i32(1052).str("").i32(1).i32(0).i32(0).i32(1).i32(0).i32(2).i32(1).i32(10).i32(20).i32(-30).bytes(new Uint8Array(16)).i32(0).bytes(new Uint8Array(8)).i32(52);
              const out = w.done(); gc.encrypt(out); reply(frame(out));
            }
            if (p[0] === 0xd0) seen.push("manor");
            if (p[0] === 0x03) {
              seen.push(`enter:${p.length}`);
              if (opts.closeOnEnter) return void queueMicrotask(() => sock.onclose?.({ code: 1000 }));
              const u = new PacketWriter().u8(0x04).i32(100).i32(200).i32(-300).i32(0).i32(1052).str("Bob").i32(0).i32(0).i32(2).i32(52).bytes(new Uint8Array(8));
              for (let i = 0; i < 6; i++) u.i32(20);
              u.i32(900).i32(850).i32(400).i32(380).bytes(new Uint8Array(40));
              const npc = new PacketWriter().u8(0x16).i32(77).i32(1000000 + 30001).i32(0).i32(150).i32(250).i32(-300).bytes(new Uint8Array(20));
              const say = new PacketWriter().u8(0x4a).i32(77).i32(0).str("Guard").str("Welcome").done();
              for (const b of [u.done(), npc.done(), say]) { gc.encrypt(b); reply(frame(b)); }
            }
          }
        }
      },
    };
    const reply = (b: Uint8Array) => queueMicrotask(() => sock.onmessage?.({ data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }));
    queueMicrotask(() => {
      sock.onopen?.({});
      if (!game) {
        const body = new PacketWriter().u8(0).i32(42).i32(0xc621).bytes(scrambleModulus(bigToBytes(N, 128))).i32(1).i32(2).i32(3).i32(4).bytes(Uint8Array.from({ length: 16 }, (_, i) => i * 7 + 1)).u8(0).done();
        const size = body.length + 8 + (8 - ((body.length + 8) % 8));
        const raw = new Uint8Array(size); raw.set(body); encXorPass(raw, 0x1234567); staticLoginCipher().encryptL2(raw);
        reply(frame(raw));
      }
    });
    return sock;
  };
  return { makeSocket, seen };
}

const tick = () => new Promise((r) => setTimeout(r, 5));
function run(opts: Parameters<typeof fakeServer>[0], password = "secret") {
  const srv = fakeServer(opts); const events: SessionEvent[] = [];
  const s = new L2Session({ loginUrl: "ws://localhost:2107", gameUrl: "ws://localhost:7778", protocol: 746, user: "Tester", password, emit: (e) => events.push(e), socket: srv.makeSocket, timeoutMs: 500 });
  s.start();
  return { s, events, srv };
}

describe("L2 login session", () => {
  it("logs in, lists servers and characters, and selects one", async () => {
    const { s, events, srv } = run({ password: "secret" });
    await tick(); await tick();
    const servers = events.find((e) => e.type === "servers");
    expect(servers && servers.type === "servers" && servers.servers[0]).toMatchObject({ id: 1, ip: "127.0.0.1", port: 7777, players: 3, maxPlayers: 500, online: true });
    s.chooseServer(1); await tick(); await tick();
    const chars = events.find((e) => e.type === "chars");
    expect(chars && chars.type === "chars" && chars.chars.map((c) => [c.name, c.level, c.classId])).toEqual([["Aria", 20, 11], ["Bob", 52, 2]]);
    expect(srv.seen).toContain("auth:Tester");
    expect(srv.seen).toContain("game-auth:tester:444:333:111:222");
    s.chooseChar(1); await tick();
    expect(srv.seen).toContain("select:1");
    const sel = events.find((e) => e.type === "selected");
    expect(sel && sel.type === "selected" && sel.char).toMatchObject({ name: "Bob", level: 52, x: 10, y: 20, z: -30 });
    expect(events.some((e) => e.type === "error")).toBe(false);
    await tick(); await tick();
    expect(srv.seen).toContain("manor");
    expect(srv.seen).toContain("enter:105");
    const worlds = events.filter((e) => e.type === "world");
    const last = worlds.at(-1);
    expect(last && last.type === "world" && last.world.self).toMatchObject({ name: "Bob", x: 100, y: 200, z: -300, hp: 850, maxHp: 900 });
    expect(last && last.type === "world" && last.world.objects[0]).toMatchObject({ kind: "npc", npcId: 30001, x: 150 });
    expect(last && last.type === "world" && last.world.chat[0]).toMatchObject({ from: "Guard", text: "Welcome" });
    expect(events.some((e) => e.type === "step" && e.step === "in-world")).toBe(true);
  });
  it("explains a server that hangs up right after EnterWorld", async () => {
    const { s, events } = run({ password: "secret", closeOnEnter: true });
    await tick(); await tick(); s.chooseServer(1); await tick(); await tick(); s.chooseChar(1); await tick(); await tick();
    expect(events.find((e) => e.type === "error")).toMatchObject({ kind: "connection", step: "entering" });
  });
  it("reports a wrong password as a login error", async () => {
    const { events } = run({ password: "secret" }, "nope");
    await tick(); await tick();
    expect(events.find((e) => e.type === "error")).toMatchObject({ kind: "login", message: "Wrong account name or password." });
  });
  it("reports a rejected protocol revision as a protocol error", async () => {
    const { s, events } = run({ password: "secret", rejectProtocol: true });
    await tick(); await tick(); s.chooseServer(1); await tick(); await tick();
    expect(events.find((e) => e.type === "error")).toMatchObject({ kind: "protocol" });
  });
  it("refuses bridges that are not on this computer", () => {
    const events: SessionEvent[] = [];
    new L2Session({ loginUrl: "ws://evil.example:2107", gameUrl: "ws://localhost:7778", protocol: 746, user: "a", password: "b", emit: (e) => events.push(e) }).start();
    expect(events[0]).toMatchObject({ type: "error", kind: "connection" });
  });
});
