import { reserveMint, claimMint } from "@/lib/shord-pool.server";
const addr = "bc1qwqdg6squsna38e46795at95yu9atm8azzmyvckulcc7kytlcckxswvvzej"; const tx = "c9b1f7abca56a9a377357d8b4da61cebf9653c20995e20b56a4ebb8fc82234fe"; const secret = "c".repeat(48);
console.log("reserve real input address ->", await reserveMint({ commitAddress: addr, claimSecret: secret, blockHeight: 1 }));
console.log("claim with that real tx ->", await claimMint({ commitAddress: addr, claimSecret: secret, commitment: "99", revealTxid: tx }));
console.log("claim with a different real tx ->", await claimMint({ commitAddress: addr, claimSecret: secret, commitment: "99", revealTxid: "c9b1f7abca56a9a377357d8b4da61cebf9653c20995e20b56a4ebb8fc82234fe".replace(/^./, "0") }));
