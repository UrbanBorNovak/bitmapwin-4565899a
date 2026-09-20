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
  name: string;
  landmark: string;
  x: number;
  y: number;
  anchorHeight: number;
};

export type AtlasPlaceIdentity = AtlasDistrictIdentity & {
  localName: string;
  address: string;
};

function mix(value: number) {
  let result = value | 0;
  result = Math.imul(result ^ (result >>> 16), 0x45d9f3b);
  result = Math.imul(result ^ (result >>> 16), 0x45d9f3b);
  return (result ^ (result >>> 16)) >>> 0;
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

export function findAtlasNamedPlace(value: string): AtlasDistrictIdentity | null {
  const query = value.trim().toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ");
  if (query.length < 3) return null;
  return DISTRICTS.find((district) => district.name === query || district.landmark === query)
    ?? DISTRICTS.find((district) => district.name.includes(query) || district.landmark.includes(query))
    ?? null;
}
