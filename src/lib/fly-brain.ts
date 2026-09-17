/**
 * FLY BRAIN — the settlers' brain, now built on a bundled connectome slice.
 *
 * Following the pattern the fly-connectome community builds all use:
 *   1. game state in  →  2. injected into sensory populations  →
 *   3. propagated through a fixed slice of fly-style wiring  →
 *   4. read back out of descending neurons (DNs)  →
 *   5. plain thresholds turn that readout into an action.
 *
 * Step 5 is ordinary code, not the connectome: the wiring supplies a
 * biologically-shaped scaffold, while thresholds here do the deciding, and the
 * excitatory/inhibitory signs are our assignment (see fly-connectome.ts). On top
 * of the network, movement still uses saccades — straight runs broken by sudden
 * turn bursts — which is what makes a fly look alive.
 *
 * Everything is arithmetic in the browser: no model calls, no server tick, so a
 * crowded Oasis stays free to run.
 */

import {
  createFlyNet,
  type DnChannel,
  type FlyNet,
  type SenseChannel,
} from "./fly-connectome";
import {
  connectomeGraph,
  createOnchainNet,
  loadConnectome,
  subscribeConnectome,
} from "./connectome-onchain";

// Pull the inscribed wiring the first time a brain module is touched. Until it
// lands (or if it never does), bodies run on the bundled slice.
if (typeof window !== "undefined") loadConnectome();




export type BrainState = "cruise" | "seek" | "work" | "pursue" | "strike" | "flee" | "pitch" | "rest";

export type BrainSense = {
  /** milliseconds, monotonic */
  now: number;
  hp: number;
  maxHp: number;
  /** true while a trap holds the body still */
  snared: boolean;
  /** current facing, radians */
  heading: number;
  /** distance in body units to the player, or null when out of range */
  playerDistance: number | null;
  /** bearing to the player, radians */
  playerAngle: number;
  /** distance to the seam/target this settler works, or null when it has none */
  workDistance: number | null;
  workAngle: number;
  /** true when this settler makes a living out of a seam */
  worker: boolean;
  /** true when this settler wants to hurt the player */
  hostile: boolean;
  /** true when this settler sells to whoever walks past */
  vendor: boolean;
};

export type BrainAct = {
  state: BrainState;
  /** heading change for this frame, radians */
  steer: number;
  /** 0..1 of the body's top speed */
  throttle: number;
  /** true on the frame a hit lands */
  strike: boolean;
  /** true on the frame a seam is chipped */
  work: boolean;
};

/** Two-way angle difference, wrapped into -PI..PI. */
function wrap(angle: number) {
  return ((angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

export type FlyBrain = {
  state: BrainState;
  /** the connectome slice this body runs on */
  net: FlyNet;
  /** mean activity of each descending-neuron group after the last step */
  readout: Record<DnChannel, number>;
  think: (sense: BrainSense, delta: number) => BrainAct;
};

/** Squash a DN group's mean activity into a 0..1 urge. */
function urge(value: number) {
  return Math.max(0, Math.tanh(value));
}

/**
 * One brain per settler. The seed keeps each body's rhythm — and its slice of
 * the shared wiring — its own, so a crowd never turns or speaks in lockstep.
 */
export function createFlyBrain(seed: number): FlyBrain {
  // saccade clock: how long until the next turn burst, and how hard it turns
  let nextSaccade = 0.3 + (seed % 1) * 0.9;
  let saccade = 0;
  let saccadeLeft = 0;
  // held plan, so a decision survives a few frames of noisy senses
  let state: BrainState = "cruise";
  let commitUntil = 0;
  // fatigue rises while running and drains while idle — settlers take breathers
  let fatigue = 0;
  // habituation: seeing the player over and over stops being interesting
  let novelty = 1;
  let lastStrike = 0;
  let lastWork = 0;
  // The inscribed connectome wins when it is decoded; the bundled slice runs the
  // body in the meantime, and a live upgrade swaps the wiring underneath.
  const initial = connectomeGraph();
  let net: FlyNet = initial ? createOnchainNet(initial, seed) : createFlyNet(seed);
  if (!initial) {
    const stop = subscribeConnectome(() => {
      const graph = connectomeGraph();
      if (!graph) return;
      net = createOnchainNet(graph, seed);
      stop();
    });
  }

  const brain: FlyBrain = {
    get state() {
      return state;
    },
    get net() {
      return net;
    },
    get readout() {
      return net.readout;
    },
    think(sense, delta) {
      const { now } = sense;
      const wounded = sense.hp / Math.max(1, sense.maxHp);
      const near = sense.playerDistance;

      // --- senses to drives -------------------------------------------------
      novelty =
        near !== null && near < 12
          ? Math.max(0.15, novelty - delta * 0.12)
          : Math.min(1, novelty + delta * 0.05);
      fatigue = Math.max(0, Math.min(1, fatigue + (state === "rest" ? -delta * 0.5 : delta * 0.02)));

      // --- senses into the sensory populations ------------------------------
      const playerBearing = near === null ? 0 : wrap(sense.playerAngle - sense.heading);
      const workBearing = sense.workDistance === null ? 0 : wrap(sense.workAngle - sense.heading);
      const input: Partial<Record<SenseChannel, number>> = {
        PLAYER_NEAR: near === null ? 0 : Math.max(0, 1 - near / 14),
        PLAYER_LEFT: near === null ? 0 : Math.max(0, -playerBearing / Math.PI),
        PLAYER_RIGHT: near === null ? 0 : Math.max(0, playerBearing / Math.PI),
        WORK_NEAR: sense.workDistance === null ? 0 : Math.max(0, 1 - sense.workDistance / 30),
        WORK_BEARING: Math.abs(workBearing) / Math.PI,
        PAIN: 1 - wounded,
        FATIGUE: fatigue,
        SNARE: sense.snared ? 1 : 0,
        ROLE_WORKER: sense.worker ? 0.6 : 0,
        ROLE_HOSTILE: sense.hostile ? 0.6 : 0,
        ROLE_VENDOR: sense.vendor ? 0.6 : 0,
      };

      // --- propagate one step through the slice, read the DNs back ----------
      const dn = net.step(input, delta);

      // Sense-level gates keep the body sane; the DN readout sets how strongly
      // each urge presses, so the wiring genuinely drives the timing.
      const fear =
        (sense.hostile ? (wounded < 0.35 ? 1 - wounded : 0) : near !== null && near < 2.2 ? 1 : 0) *
        (0.5 + urge(dn.DN_FLEE));
      const aggression =
        (sense.hostile && near !== null && near < 14 ? 1 - near / 14 : 0) *
        (0.5 + urge(dn.DN_STRIKE));
      const greed =
        (sense.worker && sense.workDistance !== null ? 0.8 : 0) * (0.5 + urge(dn.DN_WORK));
      const trade =
        (sense.vendor && near !== null && near < 9 ? (1 - near / 9) * novelty : 0) *
        (0.5 + urge(dn.DN_PITCH));
      const halt = urge(dn.DN_STOP);

      // --- pick a plan, then hold it ---------------------------------------
      if (now >= commitUntil) {
        let next: BrainState = "cruise";
        let hold = 500;
        if (fear > 0.5) {
          next = "flee";
          hold = 900;
        } else if (aggression > 0.05) {
          next = near !== null && near < 2 ? "strike" : "pursue";
          hold = next === "strike" ? 260 : 500;
        } else if (trade > 0.15) {
          next = "pitch";
          hold = 1_200;
        } else if (greed > 0) {
          next = sense.workDistance !== null && sense.workDistance < 1.4 ? "work" : "seek";
          hold = 700;
        } else if (fatigue > 0.85 || halt > 0.9) {
          next = "rest";
          hold = 2_600;
        }
        state = next;
        commitUntil = now + hold;
      }


      // --- act --------------------------------------------------------------
      if (sense.snared) return { state, steer: 0, throttle: 0, strike: false, work: false };

      let steer = 0;
      let throttle = 0;
      let strike = false;
      let work = false;

      const turnTo = (target: number, gain: number) =>
        wrap(target - sense.heading) * Math.min(1, delta * gain);

      switch (state) {
        case "flee":
          steer = turnTo(sense.playerAngle + Math.PI, 3);
          throttle = 1;
          break;
        case "pursue":
          steer = turnTo(sense.playerAngle, 2.6);
          throttle = 1;
          break;
        case "strike":
          steer = turnTo(sense.playerAngle, 3.4);
          throttle = 0.12;
          if (now - lastStrike > 2_600) {
            lastStrike = now;
            strike = true;
          }
          break;
        case "pitch":
          steer = turnTo(sense.playerAngle, 3);
          throttle = 0;
          break;
        case "seek":
          steer = turnTo(sense.workAngle, 2.6);
          throttle = 0.9;
          break;
        case "work":
          steer = turnTo(sense.workAngle, 3);
          throttle = 0;
          if (now - lastWork > 1_400) {
            lastWork = now;
            work = true;
          }
          break;
        case "rest":
          throttle = 0;
          break;
        default: {
          // Cruise on saccades: run straight, then flick to a new heading.
          saccadeLeft -= delta;
          if (saccadeLeft <= 0) {
            nextSaccade -= delta;
            if (nextSaccade <= 0) {
              const roll = Math.sin(now * 0.0007 + seed) * 0.5 + 0.5;
              saccade = (roll < 0.5 ? -1 : 1) * (0.5 + roll * 1.6);
              saccadeLeft = 0.12 + roll * 0.16;
              nextSaccade = 0.5 + roll * 1.6;
            }
          }
          steer = saccadeLeft > 0 ? saccade * delta * 6 : Math.sin(now / 2_300 + seed) * delta * 0.5;
          throttle = 0.7;
          // Back off when the player is right on top of them.
          if (near !== null && near < 2.4) {
            steer = turnTo(sense.playerAngle + Math.PI, 2.4);
            throttle = 0.9;
          }
        }
      }

      if (throttle > 0.5) fatigue = Math.min(1, fatigue + delta * 0.05);
      return { state, steer, throttle, strike, work };
    },
  };
  return brain;
}
