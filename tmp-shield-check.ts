import { reserveMint, claimMint, poolAddress } from "@/lib/shord-pool.server";

const commit = "bc1p" + "q".repeat(58); // deliberately invalid taproot data
const good = "bc1pna5d4ume43u2xnpyc5a6euldk0s7ht0jl95yxffu800pqe93qjpqcf5jmg";
const secret = "a".repeat(48);

console.log("pool address:", poolAddress());
console.log("bad commit address ->", await reserveMint({ commitAddress: "not-an-address", claimSecret: secret, blockHeight: 819245 }));
const r1 = await reserveMint({ commitAddress: good, claimSecret: secret, blockHeight: 819245 });
console.log("reserve ->", r1);
console.log("reserve again (dup) ->", await reserveMint({ commitAddress: good, claimSecret: secret, blockHeight: 819245 }));
console.log("claim wrong secret ->", await claimMint({ commitAddress: good, claimSecret: "b".repeat(48), commitment: "12345", revealTxid: "0".repeat(64) }));
console.log("claim unknown address ->", await claimMint({ commitAddress: "bc1qqmu6el7rxdc2va4kzqexhll6ulmrdkwmcdqkxd", claimSecret: secret, commitment: "12345", revealTxid: "0".repeat(64) }));
console.log("claim bad commitment ->", await claimMint({ commitAddress: good, claimSecret: secret, commitment: "0", revealTxid: "0".repeat(64) }));
console.log("claim unknown tx ->", await claimMint({ commitAddress: good, claimSecret: secret, commitment: "12345", revealTxid: "1".repeat(64) }));
console.log("claim real unrelated tx ->", await claimMint({ commitAddress: good, claimSecret: secret, commitment: "12345", revealTxid: "a88ea0bf" + "0".repeat(56) }));
