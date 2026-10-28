/** Unhinged Advent: 24 doors, each opens at 00:00 UTC on Dec N of ADVENT_YEAR. */
export const ADVENT_YEAR = 2026;

export type AdventDoor = { day: number; title: string; story: string };

export const ADVENT_DOORS: AdventDoor[] = [
  { day: 1, title: "THE FOG TURNS TO EGGNOG", story: "The Oasis fog curdles. Everyone wades through fermented block dairy at 90% speed." },
  { day: 2, title: "MEMPOOL SNOWED IN", story: "Transactions pile up like snowdrifts. A sad elf shovels them one sat/vB at a time." },
  { day: 3, title: "THE GUARDIAN WANTS PRESENTS", story: "Block #208's Guardian refuses to move until someone brings it a voxel sock." },
  { day: 4, title: "CAFÉ COFFEE GOES SENTIENT", story: "The Bit-Café espresso machine starts quoting the whitepaper and won't stop." },
  { day: 5, title: "MARAUDERS STEAL THE SLEIGH", story: "A Bitcopter crashes into the Café roof with a smoking crate of stolen sats." },
  { day: 6, title: "SANTA FAILS KYC", story: "Santa gets rejected at the Grandstand door. No BIP-322 signature, no entry." },
  { day: 7, title: "THE TREE IS A FORK", story: "Someone plants a Christmas tree on two chains at once. Both sides claim the star." },
  { day: 8, title: "DUST ATTACK OF THE SNOWFLAKES", story: "546-sat snowflakes land in every wallet. Nobody knows who sent them." },
  { day: 9, title: "ELF UNION STRIKE", story: "The Forge elves down tools demanding higher BIT royalties per stamped module." },
  { day: 10, title: "ROGUE FORK IN THE BATCAVE", story: "dev9's racks catch fire and a voxel clone starts muttering about recursion." },
  { day: 11, title: "REINDEER ON THE BLOCKCHAIN", story: "Nine reindeer are inscribed as one parcel. The Mondrian math says only one fits." },
  { day: 12, title: "THE GREAT GIFT WRAP DEBATE", story: "Taproot or legacy wrapping paper? The Grandstand splits into two angry sections." },
  { day: 13, title: "CHIMNEY OVERFLOW", story: "Santa's chimney payload exceeds 400kB. He gets stuck halfway into block 840,000." },
  { day: 14, title: "KARAOKE AT THE CAFÉ", story: "The jukebox only plays one song: the sound of a hard drive syncing a full node." },
  { day: 15, title: "THE MISSING PARCEL", story: "Tx index 0 of a BITMAP vanishes. Detectives suspect the coinbase." },
  { day: 16, title: "THE CURSED FRUITCAKE", story: "A 1-sat voxel fruitcake passes wallet to wallet. Holding it makes you glow green." },
  { day: 17, title: "BLOCK REWARD HANGOVER", story: "Miners party too hard. The next block arrives 47 minutes late and very apologetic." },
  { day: 18, title: "GINGERBREAD DISTRICT", story: "Someone forges an entire district out of gingerbread voxels. The ants arrive." },
  { day: 19, title: "THE ARCADE GOES NAUGHTY", story: "The Mempool Arcade cabinets start keeping a naughty list of fee-cheapskates." },
  { day: 20, title: "SECRET SAT SANTA", story: "Shadow presents appear. Nobody knows who gave what, and that's the point." },
  { day: 21, title: "SNOWBALL FIGHT IN THE OASIS", story: "Block-density snowballs knock voxel hats off. Founders Row takes heavy losses." },
  { day: 22, title: "THE HIGHLANDS FREEZE", story: "The Highland Charge army slips on ice. The cavalry slides straight past them." },
  { day: 23, title: "SANTA RUNS A NODE", story: "Santa finally syncs. He verifies the naughty list himself. Don't trust, verify." },
  { day: 24, title: "GENESIS NIGHT", story: "Everyone who checked in gathers at the Grandstand for the great sat gift drop." },
];

export function doorOpensAt(day: number): number {
  return Date.UTC(ADVENT_YEAR, 11, day);
}

export function isDoorOpen(day: number, now: number): boolean {
  return now >= doorOpensAt(day);
}
