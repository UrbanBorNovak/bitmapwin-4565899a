import {
  EMPTY_SNAPSHOT,
  RUNTIME_LIMITS,
  type ExtenderContext,
  type ExtenderSnapshot,
} from "@/lib/extender-sdk";

/**
 * The extender sandbox.
 *
 * Extender code is untrusted third-party JavaScript, so it never runs on the
 * page. Each running deployment gets its own worker built from a Blob: there is
 * no DOM, no router, no Supabase client and no session in there, and the worker
 * bootstrap shadows `fetch`, `XMLHttpRequest`, `WebSocket`, `importScripts` and
 * friends before evaluating the code. The only thing that crosses back is a
 * snapshot of props, quests and log lines — pure data the world renders.
 *
 * Breaking a limit (too many props, a throwing tick handler, a hung setup) stops
 * that one extender and reports the error; the world keeps running.
 */

const WORKER_SOURCE = String.raw`
var LIMITS = null;
var land = null;
var props = new Map();
var quests = new Map();
var logs = [];
var handlers = { tick: [], interact: [], enter: [], leave: [] };
var seq = 0;
var seed = 1;
var time = 0;
var lastPlayer = null;
var tickErrors = 0;
var stopped = false;
var timer = null;
var sharedState = {};
var playerState = {};
var savedQuests = {};
var savedProps = {};
var persistIds = {};
var dirty = false;
var lastFlush = 0;


function fail(message) {
  if (stopped) return;
  stopped = true;
  if (timer) clearInterval(timer);
  postMessage({ type: "error", message: String(message).slice(0, 300) });
  close();
}

function num(value, fallback, limit) {
  var n = typeof value === "number" && isFinite(value) ? value : fallback;
  if (n > limit) n = limit;
  if (n < -limit) n = -limit;
  return n;
}

function text(value, max) {
  if (value === null || value === undefined) return null;
  return String(value).slice(0, max);
}

function colour(value, fallback) {
  if (typeof value !== "string") return fallback;
  var v = value.trim().slice(0, 24);
  return /^#[0-9a-fA-F]{3,8}$/.test(v) || /^[a-zA-Z]{3,20}$/.test(v) ? v : fallback;
}

function makeProp(spec, shape) {
  if (props.size >= LIMITS.maxProps) fail("PROP LIMIT REACHED (" + LIMITS.maxProps + ")");
  if (stopped) throw new Error("stopped");
  seq += 1;
  var id = spec && typeof spec.id === "string" ? String(spec.id).slice(0, 40) : "p" + seq;
  var reach = LIMITS.maxReach;
  var record = {
    id: id,
    shape: shape,
    x: num(spec.x, 0, reach),
    y: num(spec.y, 0, LIMITS.maxHeight),
    z: num(spec.z, 0, reach),
    w: Math.max(0.02, num(spec.w, 1, reach)),
    h: Math.max(0.02, num(spec.h, spec.w === undefined ? 1 : spec.w, LIMITS.maxHeight)),
    d: Math.max(0.02, num(spec.d, spec.w === undefined ? 1 : spec.w, reach)),
    color: colour(spec.color, "#f7931a"),
    rotationY: num(spec.rotationY, 0, 64),
    glow: Boolean(spec.glow),
    interactive: Boolean(spec.interactive),
    label: text(spec.label, 40),
    inscriptionId: shape === "model" ? text(spec.inscriptionId, 80) : null,
  };
  if (spec && spec.persist) {
    persistIds[id] = true;
    var saved = savedProps[id];
    if (saved) {
      if (saved.removed) return { get id() { return id; }, set: function () {}, remove: function () {} };
      if (saved.x !== undefined) record.x = num(saved.x, record.x, reach);
      if (saved.y !== undefined) record.y = num(saved.y, record.y, LIMITS.maxHeight);
      if (saved.z !== undefined) record.z = num(saved.z, record.z, reach);
      if (saved.rotationY !== undefined) record.rotationY = num(saved.rotationY, record.rotationY, 64);
      if (saved.color !== undefined) record.color = colour(saved.color, record.color);
      if (saved.label !== undefined) record.label = text(saved.label, 40);
      if (saved.glow !== undefined) record.glow = Boolean(saved.glow);
    }
  }
  props.set(id, record);
  return {
    get id() {
      return id;
    },
    set: function (patch) {
      var current = props.get(id);
      if (!current || !patch) return;
      if (patch.x !== undefined) current.x = num(patch.x, current.x, LIMITS.maxReach);
      if (patch.y !== undefined) current.y = num(patch.y, current.y, LIMITS.maxHeight);
      if (patch.z !== undefined) current.z = num(patch.z, current.z, LIMITS.maxReach);
      if (patch.w !== undefined) current.w = Math.max(0.02, num(patch.w, current.w, LIMITS.maxReach));
      if (patch.h !== undefined) current.h = Math.max(0.02, num(patch.h, current.h, LIMITS.maxHeight));
      if (patch.d !== undefined) current.d = Math.max(0.02, num(patch.d, current.d, LIMITS.maxReach));
      if (patch.rotationY !== undefined) current.rotationY = num(patch.rotationY, current.rotationY, 64);
      if (patch.color !== undefined) current.color = colour(patch.color, current.color);
      if (patch.label !== undefined) current.label = text(patch.label, 40);
      if (patch.glow !== undefined) current.glow = Boolean(patch.glow);
      if (persistIds[id]) dirty = true;
    },
    remove: function () {
      props.delete(id);
      if (persistIds[id]) {
        savedProps[id] = { removed: true };
        dirty = true;
      }
    },
  };
}


function buildApi() {
  var world = {
    prop: function (spec) {
      var s = spec || {};
      var shape = ["box", "cylinder", "sphere", "cone", "plane"].indexOf(s.shape) >= 0 ? s.shape : "box";
      return makeProp(s, shape);
    },
    model: function (spec) {
      var s = spec || {};
      if (typeof s.inscriptionId !== "string") throw new Error("world.model needs an inscriptionId");
      return makeProp(s, "model");
    },
    count: function () {
      return props.size;
    },
  };

  var quest = {
    add: function (spec) {
      var s = spec || {};
      if (quests.size >= LIMITS.maxQuests) return;
      var id = text(s.id, 40) || "q" + (quests.size + 1);
      var restored = savedQuests[id];
      quests.set(id, {
        id: id,
        title: text(s.title, 80) || "UNTITLED QUEST",
        detail: text(s.detail, 240) || "",
        reward: text(s.reward, 60) || "",
        state: ["open", "active", "done"].indexOf(restored) >= 0 ? restored : "open",
      });
    },
    state: function (id, state) {
      var key = text(id, 40);
      var q = quests.get(key);
      if (!q) return;
      if (["open", "active", "done"].indexOf(state) >= 0 && q.state !== state) {
        q.state = state;
        savedQuests[key] = state;
        dirty = true;
      }
    },
    remove: function (id) {
      quests.delete(text(id, 40));
    },
  };

  function clean(value, depth) {
    if (value === null || value === undefined) return null;
    var kind = typeof value;
    if (kind === "number") return isFinite(value) ? value : 0;
    if (kind === "boolean") return value;
    if (kind === "string") return value.slice(0, 2000);
    if (depth > 4) return null;
    if (Array.isArray(value)) {
      var list = [];
      for (var i = 0; i < Math.min(value.length, 500); i++) list.push(clean(value[i], depth + 1));
      return list;
    }
    if (kind === "object") {
      var out = {};
      var keys = Object.keys(value).slice(0, 200);
      for (var k = 0; k < keys.length; k++) out[keys[k]] = clean(value[keys[k]], depth + 1);
      return out;
    }
    return null;
  }

  function bucket(store) {
    return {
      get: function (key, fallback) {
        var k = text(key, 60);
        return k !== null && store[k] !== undefined ? store[k] : fallback === undefined ? null : fallback;
      },
      set: function (key, value) {
        var k = text(key, 60);
        if (k === null) return;
        if (Object.keys(store).length >= 200 && store[k] === undefined) return;
        store[k] = clean(value, 0);
        dirty = true;
      },
      add: function (key, amount) {
        var k = text(key, 60);
        if (k === null) return 0;
        var next = (typeof store[k] === "number" ? store[k] : 0) + (Number(amount) || 0);
        store[k] = isFinite(next) ? next : 0;
        dirty = true;
        return store[k];
      },
      remove: function (key) {
        var k = text(key, 60);
        if (k !== null) {
          delete store[k];
          dirty = true;
        }
      },
      all: function () {
        return JSON.parse(JSON.stringify(store));
      },
    };
  }

  var state = bucket(sharedState);
  state.player = bucket(playerState);

  function on(event, handler) {
    if (typeof handler !== "function") return;
    if (!handlers[event]) return;
    if (handlers[event].length > 8) return;
    handlers[event].push(handler);
  }

  function log() {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) {
      var value = arguments[i];
      parts.push(typeof value === "object" ? JSON.stringify(value) : String(value));
    }
    logs.push(parts.join(" ").slice(0, 160));
    if (logs.length > LIMITS.maxLogs) logs.shift();
  }

  function random() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }

  function randomInt(min, max) {
    var lo = Math.ceil(Number(min) || 0);
    var hi = Math.floor(Number(max) || 0);
    if (hi < lo) return lo;
    return lo + Math.floor(random() * (hi - lo + 1));
  }

  return { world: world, quest: quest, state: state, on: on, log: log, random: random, randomInt: randomInt };
}

/** Reports saved world state back to the page, which writes it to the database. */
function flush(force) {
  if (!dirty) return;
  var now = Date.now();
  if (!force && now - lastFlush < 1500) return;
  lastFlush = now;
  dirty = false;
  props.forEach(function (record) {
    if (!persistIds[record.id]) return;
    savedProps[record.id] = {
      x: record.x, y: record.y, z: record.z,
      rotationY: record.rotationY, color: record.color, label: record.label, glow: record.glow,
    };
  });
  postMessage({
    type: "state",
    state: {
      shared: Object.assign({}, sharedState, { __quests: savedQuests, __props: savedProps }),
      player: playerState,
    },
  });
}


function fire(event, payload) {
  var list = handlers[event] || [];
  for (var i = 0; i < list.length; i++) {
    try {
      list[i](payload);
    } catch (error) {
      tickErrors += 1;
      logs.push("ERROR in " + event + ": " + String(error && error.message ? error.message : error).slice(0, 120));
      if (logs.length > LIMITS.maxLogs) logs.shift();
      if (tickErrors >= LIMITS.maxTickErrors) fail("HANDLER FAILED " + tickErrors + " TIMES: " + (error && error.message));
      return;
    }
  }
}

function snapshot() {
  var list = [];
  props.forEach(function (value) {
    list.push(value);
  });
  var questList = [];
  quests.forEach(function (value) {
    questList.push(value);
  });
  postMessage({ type: "snapshot", snapshot: { props: list, quests: questList, logs: logs.slice(-LIMITS.maxLogs), time: time } });
}

function start(message) {
  LIMITS = message.limits;
  land = Object.freeze({
    height: message.context.height,
    club: message.context.club,
    owner: message.context.owner,
    config: message.context.config || {},
  });
  seed = (Math.abs(message.context.height) % 2147483647) + 7;

  // restore anything the previous session saved before code runs
  var saved = message.state || {};
  var savedShared = saved.shared && typeof saved.shared === "object" ? saved.shared : {};
  playerState = saved.player && typeof saved.player === "object" ? saved.player : {};
  savedQuests = savedShared.__quests && typeof savedShared.__quests === "object" ? savedShared.__quests : {};
  savedProps = savedShared.__props && typeof savedShared.__props === "object" ? savedShared.__props : {};
  sharedState = {};
  Object.keys(savedShared).forEach(function (key) {
    if (key !== "__quests" && key !== "__props") sharedState[key] = savedShared[key];
  });

  var api = buildApi();
  var blocked = [
    "fetch", "XMLHttpRequest", "WebSocket", "importScripts", "EventSource", "indexedDB",
    "caches", "Request", "Response", "postMessage", "onmessage", "close", "self",
    "globalThis", "Worker", "SharedWorker", "Notification", "navigator", "location",
  ];
  var args = ["land", "world", "quest", "state", "on", "log", "random", "randomInt"].concat(blocked);
  var values = [land, api.world, api.quest, api.state, api.on, api.log, api.random, api.randomInt].concat(
    blocked.map(function () {
      return undefined;
    }),
  );

  try {
    var factory = new Function(args.join(","), '"use strict";' + message.code);
    factory.apply(undefined, values);
  } catch (error) {
    fail("SETUP FAILED: " + (error && error.message ? error.message : error));
    return;
  }

  snapshot();
  timer = setInterval(function () {
    if (stopped) return;
    time += LIMITS.tickMs / 1000;
    fire("tick", { time: time, dt: LIMITS.tickMs / 1000, player: lastPlayer });
    if (!stopped) {
      snapshot();
      flush(false);
    }
  }, LIMITS.tickMs);
}

onmessage = function (event) {
  var message = event.data;
  if (!message || stopped) return;
  if (message.type === "init") {
    start(message);
    return;
  }
  if (message.type === "player") {
    var had = lastPlayer;
    lastPlayer = message.player;
    if (!had && lastPlayer) fire("enter", { player: lastPlayer });
    if (had && !lastPlayer) fire("leave", {});
    if (had && !lastPlayer) flush(true);
    return;
  }
  if (message.type === "interact") {
    fire("interact", { propId: message.propId, player: lastPlayer });
    snapshot();
    flush(true);
    return;
  }
  if (message.type === "stop") {
    flush(true);
    stopped = true;
    if (timer) clearInterval(timer);
    close();
  }
};

`;

let cachedUrl: string | null = null;
function workerUrl(): string {
  if (cachedUrl) return cachedUrl;
  cachedUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
  return cachedUrl;
}

export type TilePlayer = { x: number; z: number; y: number } | null;

export type ExtenderRuntime = {
  /** Latest data-only snapshot from the sandbox. */
  snapshot: () => ExtenderSnapshot;
  /** Latest saved state reported by the sandbox, or null if nothing changed. */
  state: () => ExtenderPersistedState | null;
  setPlayer: (player: TilePlayer) => void;
  interact: (propId: string) => void
  stop: () => void;
};

export type RuntimeCallbacks = {
  onSnapshot: (snapshot: ExtenderSnapshot) => void;
  onError: (message: string) => void;
  /** Fired whenever the sandbox changes persistent state (quests, counters, saved props). */
  onState?: (state: ExtenderPersistedState) => void;
};

/**
 * Boot one extender. Returns a handle; always call `stop()` when unmounting.
 * `restored` is the state saved by earlier sessions — pass `EMPTY_STATE` for a
 * throwaway preview so nothing from the studio touches live world state.
 */
export function startExtender(
  code: string,
  context: ExtenderContext,
  callbacks: RuntimeCallbacks,
  restored: ExtenderPersistedState = EMPTY_STATE,
): ExtenderRuntime {
  let latest: ExtenderSnapshot = EMPTY_SNAPSHOT;
  let latestState: ExtenderPersistedState | null = null;
  let dead = false;

  if (code.length > RUNTIME_LIMITS.maxCodeBytes) {
    callbacks.onError(`CODE TOO LARGE (${code.length} BYTES, LIMIT ${RUNTIME_LIMITS.maxCodeBytes})`);
    return {
      snapshot: () => latest,
      state: () => null,
      setPlayer: () => {},
      interact: () => {},
      stop: () => {},
    };
  }

  const worker = new Worker(workerUrl());
  const setup = window.setTimeout(() => {
    if (latest.props.length === 0 && !dead) {
      dead = true;
      worker.terminate();
      callbacks.onError("SETUP TIMED OUT — CODE NEVER FINISHED BUILDING");
    }
  }, RUNTIME_LIMITS.initTimeoutMs);

  worker.onmessage = (event: MessageEvent) => {
    const message = event.data as {
      type: string;
      snapshot?: ExtenderSnapshot;
      state?: ExtenderPersistedState;
      message?: string;
    };
    if (message.type === "snapshot" && message.snapshot) {
      window.clearTimeout(setup);
      latest = message.snapshot;
      callbacks.onSnapshot(message.snapshot);
      return;
    }
    if (message.type === "state" && message.state) {
      latestState = message.state;
      callbacks.onState?.(message.state);
      return;
    }
    if (message.type === "error") {
      dead = true;
      window.clearTimeout(setup);
      callbacks.onError(message.message ?? "EXTENDER STOPPED");
      worker.terminate();
    }
  };
  worker.onerror = (event) => {
    dead = true;
    window.clearTimeout(setup);
    callbacks.onError(event.message || "EXTENDER CRASHED");
    worker.terminate();
  };

  worker.postMessage({ type: "init", code, context, limits: RUNTIME_LIMITS, state: restored });

  return {
    snapshot: () => latest,
    state: () => latestState,
    setPlayer: (player) => {
      if (!dead) worker.postMessage({ type: "player", player });
    },
    interact: (propId) => {
      if (!dead) worker.postMessage({ type: "interact", propId });
    },
    stop: () => {
      dead = true;
      window.clearTimeout(setup);
      try {
        worker.postMessage({ type: "stop" });
      } catch {
        // worker already gone
      }
      worker.terminate();
    },
  };
}

