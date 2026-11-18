// Client login + character selection for a Lineage II (Interlude-style) server reached through
// local WebSocket bridges (e.g. websockify) that relay raw TCP bytes. Nothing here is stored.
import { Blowfish } from "./blowfish";
import { decXorPass, GameCrypt, rd32, rsaNoPad, sealLoginPacket, staticLoginCipher, unscrambleModulus, verifyChecksum } from "./l2-crypt";
import { Framer, frame, PacketReader, PacketWriter, utf16z } from "./l2-packets";
import { isLocalBridgeUrl } from "./game-folder";

export type Step = "login-bridge" | "handshake" | "gameguard" | "account" | "servers" | "ticket" | "game-bridge" | "protocol" | "characters" | "selected";
export const STEPS: { id: Step; label: string }[] = [
  { id: "login-bridge", label: "Reach login bridge" }, { id: "handshake", label: "Login handshake" },
  { id: "gameguard", label: "GameGuard check" }, { id: "account", label: "Account login" },
  { id: "servers", label: "Server list" }, { id: "ticket", label: "Server ticket" },
  { id: "game-bridge", label: "Reach game bridge" }, { id: "protocol", label: "Protocol accepted" },
  { id: "characters", label: "Character list" }, { id: "selected", label: "Character selected" },
];
export type ErrorKind = "connection" | "protocol" | "login";
export interface L2Server { id: number; ip: string; port: number; online: boolean; players: number; maxPlayers: number; pvp: boolean; ageLimit: number }
export interface L2Char { slot: number; name: string; objectId: number; level: number; classId: number; race: number; sex: number; x: number; y: number; z: number; hp: number; mp: number; clanId: number; deleteTimer: number }
export interface L2Selected { name: string; title: string; objectId: number; classId: number; race: number; level: number; x: number; y: number; z: number; hp: number; mp: number }
export type SessionEvent =
  | { type: "step"; step: Step }
  | { type: "servers"; servers: L2Server[]; lastServer: number }
  | { type: "chars"; chars: L2Char[] }
  | { type: "selected"; char: L2Selected }
  | { type: "error"; kind: ErrorKind; step: Step; message: string; hint?: string | undefined }
  | { type: "log"; conn: "login" | "game"; dir: "in" | "out"; opcode: number; size: number };

export interface SocketLike {
  binaryType: string;
  onopen: ((e: unknown) => void) | null; onmessage: ((e: { data: unknown }) => void) | null;
  onerror: ((e: unknown) => void) | null; onclose: ((e: { code?: number }) => void) | null;
  send(d: Uint8Array): void; close(): void;
}
export interface SessionOptions {
  loginUrl: string; gameUrl: string; protocol: number; user: string; password: string;
  emit: (e: SessionEvent) => void;
  socket?: (url: string) => SocketLike; timeoutMs?: number;
}

const LOGIN_FAIL: Record<number, string> = {
  0x01: "The server had a system error.", 0x02: "Wrong password.", 0x03: "Wrong account name or password.",
  0x04: "Access denied for this account.", 0x05: "Account information is incorrect.", 0x07: "This account is already logged in.",
  0x09: "This account is banned or suspended.", 0x0f: "The server is full.", 0x10: "The server is under maintenance.",
  0x11: "Temporary password expired.", 0x23: "Too many connections from this computer.",
};
const PLAY_FAIL: Record<number, string> = { 0x01: "The server had a system error.", 0x02: "Wrong account name or password.", 0x04: "Access to this server was denied.", 0x0f: "That game server is full." };
const GG = [0x29dd954e, 0x77c39cfc, 0x97adb620, 0x07bde0f7];
const hex = (n: number) => "0x" + n.toString(16).padStart(2, "0");

export class ProtocolError extends Error {}

/** CharSelectionInfo layouts differ per chronicle, so records are anchored on the account name each one repeats. */
export function parseCharList(body: Uint8Array, login: string): L2Char[] {
  const r = new PacketReader(body, 1);
  const count = r.i32("character count");
  if (count < 0 || count > 7) throw new ProtocolError(`Character list says ${count} characters; expected 0–7. Wrong protocol revision?`);
  if (count === 0) return [];
  const anchor = utf16z(login.toLowerCase());
  const hits: number[] = [];
  outer: for (let p = 5; p + anchor.length <= body.length && hits.length < count; p++) {
    for (let k = 0; k < anchor.length; k++) if (body[p + k] !== anchor[k]) continue outer;
    if (p - 6 < 5 || body[p - 6] !== 0 || body[p - 5] !== 0) continue;
    hits.push(p); p += anchor.length - 1;
  }
  if (hits.length !== count) throw new ProtocolError(`Found ${hits.length} of ${count} characters in the list. This server's character packet layout isn't recognised yet.`);
  const starts = hits.map((p, i) => {
    if (i === 0) return 5;
    let s = p - 6; // name's null terminator
    while (s - 2 >= 5 && s - (p - 6) > -32) { const c = body[s - 2]! | (body[s - 1]! << 8); if (!/[A-Za-z0-9_]/.test(String.fromCharCode(c))) break; s -= 2; }
    return s;
  });
  return hits.map((p, i) => {
    const n = new PacketReader(body, starts[i]!);
    const name = n.str("character name"); const objectId = n.i32("object id");
    n.pos = p + anchor.length;
    n.i32(); const clanId = n.i32(); n.i32();
    const sex = n.i32("sex"), race = n.i32("race"), baseClass = n.i32("class"); n.i32();
    const x = n.i32(), y = n.i32(), z = n.i32(), hp = n.f64(), mp = n.f64(); n.i32(); n.i64("exp");
    const level = n.i32("level");
    const end = i + 1 < count ? starts[i + 1]! : body.length;
    let classId = baseClass, deleteTimer = 0;
    for (const back of [13, 9]) { // with / without augmentation id at the end
      if (end - back - 4 < n.pos) continue;
      const c = rd32(body, end - back);
      if (c <= 136) { classId = c; deleteTimer = rd32(body, end - back - 4); break; }
    }
    return { slot: i, name, objectId, level, classId, race, sex, x, y, z, hp, mp, clanId, deleteTimer };
  });
}

export class L2Session {
  private step: Step = "login-bridge";
  private ws: SocketLike | null = null;
  private framer = new Framer();
  private conn: "login" | "game" = "login";
  private bf: Blowfish | null = null;
  private game: GameCrypt | null = null;
  private sessionId = 0; private modulus: Uint8Array | null = null;
  private loginOk = [0, 0]; private playOk = [0, 0];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private finished = false;
  servers: L2Server[] = []; chars: L2Char[] = [];

  constructor(private o: SessionOptions) {}

  private set(step: Step) { this.step = step; this.o.emit({ type: "step", step }); }
  private fail(kind: ErrorKind, message: string, hint?: string) {
    if (this.finished) return;
    this.finished = true; this.clearTimer();
    this.o.emit({ type: "error", kind, step: this.step, message, hint });
    const w = this.ws; this.ws = null; try { w?.close(); } catch { /* already closed */ }
  }
  private clearTimer() { if (this.timer) clearTimeout(this.timer); this.timer = null; }
  private expect(what: string, hint: string) {
    this.clearTimer();
    this.timer = setTimeout(() => this.fail("protocol", `No answer from the server while waiting for ${what}.`, hint), this.o.timeoutMs ?? 10000);
  }

  start() {
    const { loginUrl, gameUrl, user, password } = this.o;
    for (const u of [loginUrl, gameUrl]) if (!isLocalBridgeUrl(u)) return this.fail("connection", `${u} is not on this computer.`, "Only ws://localhost or ws://127.0.0.1 bridges are allowed.");
    if (!/^[\x20-\x7e]{1,14}$/.test(user)) return this.fail("login", "Account name must be 1–14 plain letters, numbers or symbols.");
    if (!/^[\x20-\x7e]{1,16}$/.test(password)) return this.fail("login", "Password must be 1–16 plain letters, numbers or symbols.");
    this.open(loginUrl, "login");
  }

  private open(url: string, conn: "login" | "game") {
    this.conn = conn; this.framer = new Framer();
    this.set(conn === "login" ? "login-bridge" : "game-bridge");
    let ws: SocketLike;
    try { ws = (this.o.socket ?? ((u) => new WebSocket(u) as unknown as SocketLike))(url); }
    catch (e) { return this.fail("connection", `Couldn't open ${url}: ${e instanceof Error ? e.message : String(e)}`); }
    ws.binaryType = "arraybuffer"; this.ws = ws;
    const bridgeHint = conn === "login"
      ? "Start the bridge next to your login server, for example: websockify 2107 127.0.0.1:2106"
      : "Start the bridge next to your game server, for example: websockify 7778 127.0.0.1:7777";
    let opened = false;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      opened = true;
      if (conn === "login") { this.set("handshake"); this.expect("the login handshake", "Is the bridge pointed at the login port (usually 2106)?"); }
      else { this.set("protocol"); this.send(new PacketWriter().u8(0x00).i32(this.o.protocol).done()); this.expect("the protocol reply", "Is the bridge pointed at the game port (usually 7777)?"); }
    };
    ws.onerror = () => { if (this.ws === ws && !opened) this.fail("connection", `Couldn't reach ${url}.`, bridgeHint); };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      if (!opened) return this.fail("connection", `Couldn't reach ${url}.`, bridgeHint);
      const why = this.step === "characters" && conn === "game"
        ? "The game server closed the connection after login. It usually means it rejected the session keys: the login and game server must belong together, and the account must not be in use."
        : `The ${conn} connection closed during “${STEPS.find((s) => s.id === this.step)?.label}”${e?.code ? ` (code ${e.code})` : ""}.`;
      this.fail(this.step === "handshake" ? "protocol" : "connection", why, this.step === "handshake" ? "The server hung up before the handshake. Check the bridge points at the right port and the server is running." : undefined);
    };
    ws.onmessage = (m) => {
      if (this.ws !== ws || this.finished) return;
      const chunk = m.data instanceof ArrayBuffer ? new Uint8Array(m.data) : ArrayBuffer.isView(m.data) ? new Uint8Array((m.data as Uint8Array).buffer) : null;
      if (!chunk) return this.fail("protocol", "The bridge sent text, not binary data.", "Use a raw TCP bridge such as websockify in binary mode.");
      try { for (const p of this.framer.push(chunk)) { this.handle(p); if (this.finished || this.ws !== ws) break; } }
      catch (e) { this.fail("protocol", e instanceof Error ? e.message : String(e)); }
    };
  }

  private send(body: Uint8Array) {
    if (!this.ws) return;
    this.o.emit({ type: "log", conn: this.conn, dir: "out", opcode: body[0]!, size: body.length });
    let raw: Uint8Array;
    if (this.conn === "login") raw = sealLoginPacket(body, this.bf!);
    else { raw = body.slice(); this.game?.encrypt(raw); }
    this.ws.send(frame(raw));
  }

  private handle(raw: Uint8Array) {
    if (this.conn === "login") return this.handleLogin(raw);
    return this.handleGame(raw);
  }

  private handleLogin(raw: Uint8Array) {
    if (!this.bf) {
      if (raw.length < 160 || raw.length % 8 !== 0) throw new ProtocolError(`The first login packet is ${raw.length} bytes. This looks like an older (C4 or earlier) login server or not a login port; only Interlude-style login (C5 onward) is supported.`);
      staticLoginCipher().decryptL2(raw); decXorPass(raw);
      this.log(raw);
      const r = new PacketReader(raw);
      if (r.u8() !== 0x00) throw new ProtocolError(`Expected the login handshake (opcode 0x00), got ${hex(raw[0]!)}.`);
      this.sessionId = r.i32("session id");
      const rev = r.u32("protocol revision");
      if (rev !== 0xc621) throw new ProtocolError(`Login protocol revision ${hex(rev)} isn't supported (expected 0xc621).`);
      this.modulus = unscrambleModulus(r.bytes(128, "public key"));
      for (let i = 0; i < 4; i++) r.i32();
      this.bf = new Blowfish(r.bytes(16, "session key"));
      this.set("gameguard");
      const w = new PacketWriter().u8(0x07).i32(this.sessionId); GG.forEach((g) => w.i32(g));
      this.send(w.done());
      return this.expect("the GameGuard reply", "");
    }
    this.bf.decryptL2(raw);
    if (!verifyChecksum(raw)) throw new ProtocolError("A login packet failed its checksum. The encryption keys don't match; is this a standard L2J-style login server?");
    this.log(raw);
    const r = new PacketReader(raw, 1);
    const op = raw[0]!;
    if (op === 0x01) return this.fail("login", LOGIN_FAIL[r.i32()] ?? "The login server refused the login.");
    if (op === 0x02) return this.fail("login", "The account was kicked by the login server.");
    if (op === 0x06) { const c = r.i32(); return this.fail("login", PLAY_FAIL[c] ?? `The login server refused entry to that game server (reason ${hex(c)}).`); }
    if (op === 0x0b && this.step === "gameguard") {
      this.set("account");
      const block = new Uint8Array(128); block[0x5b] = 0x24;
      for (let i = 0; i < this.o.user.length; i++) block[0x5e + i] = this.o.user.charCodeAt(i);
      for (let i = 0; i < this.o.password.length; i++) block[0x6c + i] = this.o.password.charCodeAt(i);
      const enc = rsaNoPad(block, this.modulus!);
      block.fill(0);
      this.o.password = "";
      this.send(new PacketWriter().u8(0x00).bytes(enc).i32(this.sessionId).bytes(new Uint8Array(16)).done());
      return this.expect("the account login reply", "");
    }
    if (op === 0x03 && this.step === "account") {
      this.loginOk = [r.i32(), r.i32()];
      this.set("servers");
      this.send(new PacketWriter().u8(0x05).i32(this.loginOk[0]!).i32(this.loginOk[1]!).u8(0x04).done());
      return this.expect("the server list", "");
    }
    if (op === 0x04 && (this.step === "servers" || this.step === "account")) {
      this.clearTimer(); this.set("servers");
      const count = r.u8("server count"), lastServer = r.u8();
      const stride = count ? Math.floor((raw.length - 3) / count) : 0;
      if (count && stride < 16) throw new ProtocolError("The server list is shorter than expected.");
      const servers: L2Server[] = [];
      for (let i = 0; i < count; i++) {
        const s = new PacketReader(raw, 3 + i * Math.min(stride, 21));
        const id = s.u8(); const ip = [s.u8(), s.u8(), s.u8(), s.u8()].join("."); const port = s.i32();
        const ageLimit = s.u8(), pvp = s.u8() === 1, players = s.u16(), maxPlayers = s.u16(), online = s.u8() === 1;
        servers.push({ id, ip, port, ageLimit, pvp, players, maxPlayers, online });
      }
      this.servers = servers;
      return this.o.emit({ type: "servers", servers, lastServer });
    }
    if (op === 0x07 && this.step === "ticket") {
      this.playOk = [r.i32(), r.i32()];
      this.clearTimer();
      const old = this.ws; this.ws = null; old?.close();
      return this.open(this.o.gameUrl, "game");
    }
    // other packets (e.g. account notices) are logged and ignored
  }

  chooseServer(id: number) {
    if (this.finished || this.step !== "servers") return;
    const s = this.servers.find((x) => x.id === id);
    if (s && !s.online) return this.fail("login", `Game server ${id} is offline.`);
    this.set("ticket");
    this.send(new PacketWriter().u8(0x02).i32(this.loginOk[0]!).i32(this.loginOk[1]!).u8(id).done());
    this.expect("the server ticket", "");
  }

  private handleGame(raw: Uint8Array) {
    if (!this.game) {
      this.log(raw);
      if (raw[0] !== 0x00 || raw.length < 10) throw new ProtocolError(`Expected the game key packet, got ${hex(raw[0]!)} (${raw.length} bytes).`);
      if (raw[1] === 0x00) return this.fail("protocol", `The game server rejected protocol revision ${this.o.protocol}.`, "Try another revision: 746/744/740/737 for Interlude, 660/656 for C4.");
      this.game = new GameCrypt(raw.subarray(2, 10));
      this.set("characters");
      this.send(new PacketWriter().u8(0x08).str(this.o.user.toLowerCase()).i32(this.playOk[1]!).i32(this.playOk[0]!).i32(this.loginOk[0]!).i32(this.loginOk[1]!).done());
      return this.expect("the character list", "");
    }
    this.game.decrypt(raw);
    this.log(raw);
    if (raw[0] === 0x13 && this.step === "characters") {
      this.clearTimer();
      this.chars = parseCharList(raw, this.o.user);
      return this.o.emit({ type: "chars", chars: this.chars });
    }
    if (raw[0] === 0x15 && this.step === "selected") {
      this.clearTimer();
      const r = new PacketReader(raw, 1);
      const name = r.str("name"), objectId = r.i32(), title = r.str("title"); r.i32(); r.i32(); r.i32();
      r.i32(); const race = r.i32(), classId = r.i32(); r.i32();
      const x = r.i32(), y = r.i32(), z = r.i32(), hp = r.f64(), mp = r.f64(); r.i32(); r.i64(); const level = r.i32();
      this.finished = true;
      return this.o.emit({ type: "selected", char: { name, title, objectId, classId, race, level, x, y, z, hp, mp } });
    }
  }

  chooseChar(slot: number) {
    if (this.finished || this.step !== "characters" || !this.chars[slot]) return;
    this.set("selected");
    this.send(new PacketWriter().u8(0x0d).i32(slot).u16(0).i32(0).i32(0).i32(0).done());
    this.expect("the selected character", "");
  }

  private log(raw: Uint8Array) { this.o.emit({ type: "log", conn: this.conn, dir: "in", opcode: raw[0]!, size: raw.length }); }

  close() { this.finished = true; this.clearTimer(); const w = this.ws; this.ws = null; try { w?.close(); } catch { /* closed */ } }
}
