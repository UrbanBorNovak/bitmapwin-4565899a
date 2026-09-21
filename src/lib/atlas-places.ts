import { ATLAS_SIDE, atlasToBlock, blockToAtlas } from "@/lib/atlas-geometry";

const DISTRICT_SIDE = 128;
const DISTRICTS_PER_SIDE = ATLAS_SIDE / DISTRICT_SIDE;

const DISTRICT_ROOTS = ["ALDER", "COPPER", "EMBER", "GLASS", "LANTERN", "ORCHARD", "SALT", "WILLOW"] as const;
const DISTRICT_FORMS = ["HARBOR", "HEIGHTS", "QUARTER", "GARDENS", "REACH", "WARD", "COMMONS", "FRONTIER"] as const;
const LANDMARKS = ["CLOCKTOWER", "LIGHTHOUSE", "OLD STATION", "FOUNDRY", "OBSERVATORY", "MARKET HALL", "STONE BRIDGE", "ARCHIVE"] as const;
const LOCAL_PREFIXES = ["ASH", "BELL", "CINDER", "DOCK", "ELM", "FORGE", "GATE", "HEARTH", "IVY", "JETTY", "KING", "LIME", "MINT", "NORTH", "OAK", "PIER"] as const;
const LOCAL_FORMS = ["COURT", "CROSSING", "LANE", "MEWS", "PLACE", "ROW", "SQUARE", "STEPS", "TERRACE", "WALK", "YARD", "CLOSE"] as const;
const ADDRESS_FORMS = ["WAY", "ROAD", "LANE", "WALK", "ROW", "STREET"] as const;

export type AtlasDistrictIdentity = {
  index: number;
  slug: string;
  name: string;
  landmark: string;
  x: number;
  y: number;
  anchorHeight: number;
};

export type AtlasDistrictStory = AtlasDistrictIdentity & {
  row: number;
  column: number;
  chapter: string;
  story: readonly [string, string];
  atmosphere: string;
  motif: "harbor" | "heights" | "quarter" | "gardens" | "reach" | "ward" | "commons" | "frontier";
};

export type AtlasPlaceIdentity = AtlasDistrictIdentity & {
  localName: string;
  address: string;
};

/** A single BITMAP promoted to a full place: its own story, illustration framing and atlas entry. */
export type AtlasPlaceStory = AtlasPlaceIdentity & {
  height: number;
  point: { x: number; y: number };
  chapter: string;
  story: readonly [string, string];
  atmosphere: string;
  motif: AtlasDistrictStory["motif"];
  /** Illustration framing: which cell of a FRAME_DIVISIONS grid over the painted atlas this place occupies. */
  frame: { divisions: number; left: number; top: number };
  neighbors: { previous: number; next: number };
};

export const PLACE_FRAME_DIVISIONS = 11;

function mix(value: number) {
  let result = value | 0;
  result = Math.imul(result ^ (result >>> 16), 0x45d9f3b);
  result = Math.imul(result ^ (result >>> 16), 0x45d9f3b);
  return (result ^ (result >>> 16)) >>> 0;
}

const OPENINGS = [
  "At first light, the paths appear one by one, as if the land remembers every traveler who crossed it.",
  "When the wind turns, old roofs and young trees answer together, carrying news from one BITMAP to the next.",
  "Rain leaves a silver map on the stones here, and each shallow pool seems to hold another version of the sky.",
  "The district wakes slowly: a door opens, a bridge hums, and distant machinery begins its patient rhythm.",
  "From above, the roads look accidental. On foot, every bend feels placed by someone who expected you.",
  "At dusk, warm windows gather around the landmark while the surrounding country falls quiet.",
  "The oldest paths avoid the highest ground, preserving a long view across the neighboring districts.",
  "Morning mist gathers in the low places before lifting to reveal the district in painted layers.",
] as const;

const CLOSINGS = [
  "Nothing here is hurried; meaning arrives through return visits, careful building, and the traces people choose to leave behind.",
  "Its character belongs less to monuments than to small acts repeated until they become local tradition.",
  "The place remains unfinished by design, leaving room for its holders and visitors to add the next remembered detail.",
  "Each new arrival changes the view slightly, while the underlying geography keeps the district recognizably itself.",
  "It is a place for quiet discoveries: a side path, a distant signal, a structure where yesterday there was open ground.",
  "The district keeps no artificial score; it values the history that can be followed back to where it happened.",
  "Seen from the atlas it is a name. Entered from the ground, it becomes a sequence of encounters and choices.",
  "Its future is held open for real activity, with every lasting addition becoming part of the visible record.",
] as const;

const ATMOSPHERES = [
  "MORNING MIST · CEDAR WIND",
  "GOLDEN HOUR · BELL WEATHER",
  "SEA LIGHT · HIGH CLOUD",
  "RAIN-WASHED STONE · LANTERNS",
  "MEADOW AIR · DISTANT WATER",
  "BLUE HOUR · WARM WINDOWS",
  "MOUNTAIN SHADOW · CLEAR SKY",
  "FRONTIER LIGHT · NEW GROWTH",
] as const;

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function atlasDistricts(): AtlasDistrictIdentity[] {
  const districts: AtlasDistrictIdentity[] = [];
  for (let row = 0; row < DISTRICTS_PER_SIDE; row += 1) {
    for (let column = 0; column < DISTRICTS_PER_SIDE; column += 1) {
      const index = row * DISTRICTS_PER_SIDE + column;
      const x = column * DISTRICT_SIDE + DISTRICT_SIDE / 2;
      const y = row * DISTRICT_SIDE + DISTRICT_SIDE / 2;
      districts.push({
        index,
        slug: slugify(`${DISTRICT_ROOTS[column]} ${DISTRICT_FORMS[row]}`),
        name: `${DISTRICT_ROOTS[column]} ${DISTRICT_FORMS[row]}`,
        landmark: `${DISTRICT_ROOTS[(column + row * 3) % DISTRICT_ROOTS.length]} ${LANDMARKS[(row + column * 5) % LANDMARKS.length]}`,
        x,
        y,
        anchorHeight: atlasToBlock(x, y),
      });
    }
  }
  return districts;
}

const DISTRICTS = atlasDistricts();

export function atlasPlace(height: number): AtlasPlaceIdentity {
  const point = blockToAtlas(height);
  const column = Math.min(DISTRICTS_PER_SIDE - 1, Math.floor(point.x / DISTRICT_SIDE));
  const row = Math.min(DISTRICTS_PER_SIDE - 1, Math.floor(point.y / DISTRICT_SIDE));
  const district = DISTRICTS[row * DISTRICTS_PER_SIDE + column] ?? DISTRICTS[0];
  if (!district) throw new Error("Atlas district index is empty");
  const seed = mix(height);
  const localName = `${LOCAL_PREFIXES[seed % LOCAL_PREFIXES.length]} ${LOCAL_FORMS[Math.floor(seed / 17) % LOCAL_FORMS.length]}`;
  const street = `${DISTRICT_ROOTS[(column + Math.floor(seed / 31)) % DISTRICT_ROOTS.length]} ${ADDRESS_FORMS[Math.floor(seed / 101) % ADDRESS_FORMS.length]}`;
  return { ...district, localName, address: `${(seed % 199) + 1} ${street}` };
}

const PLACE_OPENINGS = [
  "It begins as a turning off the main road: a handful of walls, a shared well, and a view that nobody here would trade away.",
  "The ground rises just enough to hold a single row of roofs, so every window here looks out over the rest of the district.",
  "Water reaches this corner first, and the paths were laid by people following it rather than fighting it.",
  "A long wall runs the length of the place, older than the buildings leaning against it, and everything else grew from that line.",
  "Carts still find the same three bends they always found, and the shape of the place is simply the shape of that habit.",
  "It sits at the quiet edge of its district, close enough to hear the landmark bell and far enough to keep its own hours.",
  "Whoever set the first stone here chose shelter over spectacle, and the place has kept that instinct ever since.",
  "Two paths cross once and never again, and the whole place is arranged around that single meeting.",
] as const;

const PLACE_CLOSINGS = [
  "What happens on this block is recorded where it happened, so the place grows a memory instead of a scoreboard.",
  "Nothing about it is decided yet; its holder writes the next part by building, hosting and returning.",
  "It is small enough that one structure changes the skyline and one visitor changes the day.",
  "Its story is held open, waiting for the kind of history that can be followed back to the block it came from.",
  "Everything lasting here begins as somebody's decision to stay a little longer than they had to.",
  "Seen from the atlas it is one cell of land. Entered on foot, it is a street with a name and a direction.",
  "The place keeps its shape and lends the rest to whoever builds on it.",
  "It asks nothing of arrivals except that they leave something worth finding again.",
] as const;

export function atlasPlaceStory(height: number): AtlasPlaceStory {
  const identity = atlasPlace(height);
  const point = blockToAtlas(height);
  const seed = mix(height * 31 + 7);
  const cell = ATLAS_SIDE / PLACE_FRAME_DIVISIONS;
  const form = DISTRICT_FORMS[Math.floor(identity.index / DISTRICTS_PER_SIDE)] ?? "FRONTIER";
  return {
    ...identity,
    height,
    point,
    chapter: `PLACE · ${identity.address}`,
    story: [
      PLACE_OPENINGS[seed % PLACE_OPENINGS.length] ?? PLACE_OPENINGS[0]!,
      PLACE_CLOSINGS[Math.floor(seed / 13) % PLACE_CLOSINGS.length] ?? PLACE_CLOSINGS[0]!,
    ],
    atmosphere: ATMOSPHERES[Math.floor(seed / 7) % ATMOSPHERES.length] ?? "CLEAR SKY · OPEN ROAD",
    motif: form.toLowerCase() as AtlasDistrictStory["motif"],
    frame: {
      divisions: PLACE_FRAME_DIVISIONS,
      // Continuous crop centred on this block, clamped inside the painting.
      left: -Math.min((PLACE_FRAME_DIVISIONS - 1) * 100, Math.max(0, (point.x / cell) * 100 - 50)),
      top: -Math.min((PLACE_FRAME_DIVISIONS - 1) * 100, Math.max(0, (point.y / cell) * 100 - 50)),
    },
    neighbors: { previous: Math.max(0, height - 1), next: height + 1 },
  };
}

export function findAtlasNamedPlace(value: string): AtlasDistrictIdentity | null {
  const query = value.trim().toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ");
  if (query.length < 3) return null;
  return DISTRICTS.find((district) => district.name === query || district.landmark === query)
    ?? DISTRICTS.find((district) => district.name.includes(query) || district.landmark.includes(query))
    ?? null;
}

export function atlasDistrictBySlug(slug: string): AtlasDistrictIdentity | null {
  const normalized = slugify(slug);
  return DISTRICTS.find((district) => district.slug === normalized) ?? null;
}

export function atlasDistrictStory(district: AtlasDistrictIdentity): AtlasDistrictStory {
  const row = Math.floor(district.index / DISTRICTS_PER_SIDE);
  const column = district.index % DISTRICTS_PER_SIDE;
  const seed = mix(district.anchorHeight + district.index * 101);
  const opening = OPENINGS[seed % OPENINGS.length] ?? OPENINGS[0] ?? "The district waits for its next visitor.";
  const closing = CLOSINGS[Math.floor(seed / 17) % CLOSINGS.length] ?? CLOSINGS[0] ?? "Its history remains open.";
  const atmosphere = ATMOSPHERES[(row + column * 3) % ATMOSPHERES.length] ?? "CLEAR SKY · OPEN ROAD";
  const form = DISTRICT_FORMS[row] ?? "Frontier";
  return {
    ...district,
    row,
    column,
    chapter: `CHAPTER ${String(district.index + 1).padStart(2, "0")} · ${district.landmark}`,
    story: [opening, closing],
    atmosphere,
    motif: form.toLowerCase() as AtlasDistrictStory["motif"],
  };
}

export function atlasDistrictNeighbors(district: AtlasDistrictIdentity): AtlasDistrictIdentity[] {
  const row = Math.floor(district.index / DISTRICTS_PER_SIDE);
  const column = district.index % DISTRICTS_PER_SIDE;
  return [[column, row - 1], [column + 1, row], [column, row + 1], [column - 1, row]]
    .map(([nextColumn, nextRow]) => {
      if (nextColumn === undefined || nextRow === undefined || nextColumn < 0 || nextRow < 0 || nextColumn >= DISTRICTS_PER_SIDE || nextRow >= DISTRICTS_PER_SIDE) return null;
      return DISTRICTS[nextRow * DISTRICTS_PER_SIDE + nextColumn] ?? null;
    })
    .filter((value): value is AtlasDistrictIdentity => value !== null);
}

/**
 * Each 128×128 district square is an aligned sub-curve of the order-10 Hilbert
 * index, so it maps to one contiguous run of block heights. That makes district
 * analytics a single range query instead of 16,384 point lookups.
 */
export const DISTRICT_BLOCK_SPAN = DISTRICT_SIDE * DISTRICT_SIDE;

export function districtBlockRange(district: AtlasDistrictIdentity): { lo: number; hi: number } {
  const base = Math.floor(atlasToBlock(district.x, district.y) / DISTRICT_BLOCK_SPAN) * DISTRICT_BLOCK_SPAN;
  return { lo: base, hi: base + DISTRICT_BLOCK_SPAN - 1 };
}

/** District that contains an atlas coordinate. */
export function districtAt(x: number, y: number): AtlasDistrictIdentity {
  const column = Math.min(DISTRICTS_PER_SIDE - 1, Math.max(0, Math.floor(x / DISTRICT_SIDE)));
  const row = Math.min(DISTRICTS_PER_SIDE - 1, Math.max(0, Math.floor(y / DISTRICT_SIDE)));
  const district = DISTRICTS[row * DISTRICTS_PER_SIDE + column] ?? DISTRICTS[0];
  if (!district) throw new Error("Atlas district index is empty");
  return district;
}

export function districtChapter(district: AtlasDistrictIdentity): string {
  return `CHAPTER ${String(district.index + 1).padStart(2, "0")}`;
}
