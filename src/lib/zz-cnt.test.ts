import {it} from "vitest";import {KITS} from "@/lib/forge-kits";import {blueprintBlocks} from "@/lib/forge-blueprints";
it("c",()=>{for(const k of KITS.slice(-2))console.log(k.id,blueprintBlocks(k).length)});
