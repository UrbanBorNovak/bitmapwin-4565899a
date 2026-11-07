/** Step-by-step: what each wallet popup means when minting a Guardian. */
import { useState } from "react";
import { GUARDIAN_PRICE_SATS } from "@/lib/bitmon";
import type { MintLang } from "@/lib/mint-lang";

type Wallet = "unisat" | "xverse";

const SHARED = [
  ["SUMMON", `Pay ${GUARDIAN_PRICE_SATS.toLocaleString("en-US")} sats (plus a few unique sats that identify you) to the treasury. After one confirmation your Guardian wakes up in the Oasis.`],
  ["COMMIT", "A small payment (about 2,000 sats) to a one-time address. That address is built from the inscription itself — it already names your BITMAP as parent. Your BITMAP is NOT moved here, and that is correct."],
  ["REVEAL", "The last popup. Input 0 is your BITMAP, Output 0 sends it straight back to you. A new 546-sat Guardian Ordinal lands in your wallet as a true child of your BITMAP."],
] as const;

const SHARED_ZH = [
  ["召唤", `向金库支付 ${GUARDIAN_PRICE_SATS.toLocaleString("en-US")} 聪（另加用于识别你的少量独特聪）。一次确认后，守护者会在绿洲中觉醒。`],
  ["提交", "向一次性地址支付约 2,000 聪的小额款项。该地址由铭文本身生成，已经将你的 BITMAP 指定为父铭文。此时不会移动 BITMAP，这是正常的。"],
  ["揭示", "最后一个弹窗。输入 0 是你的 BITMAP，输出 0 会将它原路返回。一个新的 546 聪守护者 Ordinal 将进入你的钱包，成为 BITMAP 的真实子铭文。"],
] as const;

const WALLET: Record<Wallet, { name: string; tips: string[] }> = {
  unisat: {
    name: "UNISAT",
    tips: [
      "Use one Taproot (bc1p…) account that holds the BITMAP. UniSat pays fees and holds Ordinals from the same address.",
      "Popup 1 and 2 are normal payments. Popup 3 shows several inputs — check that your BITMAP comes back to your own address.",
      "If UniSat warns about spending an inscription on popup 3, that is the BITMAP being used as parent and returned in the same transaction.",
    ],
  },
  xverse: {
    name: "XVERSE",
    tips: [
      "Xverse has two addresses: Payment (starts with 3… or bc1q…) pays the fees; Ordinals (bc1p…) must hold the BITMAP.",
      "Popup 2 spends from your Payment address — you will not see the BITMAP there. That is expected.",
      "Popup 3 asks you to sign inputs from BOTH addresses. Approve all of them, or the reveal can't include your BITMAP.",
      "If you closed the tab mid-way, open My Inscription Payments — your commit is saved and you can finish without paying again.",
    ],
  },
};

const WALLET_ZH: Record<Wallet, { name: string; tips: string[] }> = {
  unisat: {
    name: "UNISAT",
    tips: [
      "使用持有该 BITMAP 的 Taproot（bc1p…）账户。UniSat 使用同一地址支付费用并持有 Ordinals。",
      "弹窗 1 和 2 是普通付款。弹窗 3 会显示多个输入——请确认 BITMAP 返回到你自己的地址。",
      "如果 UniSat 在弹窗 3 警告正在支出铭文，那是因为 BITMAP 被用作父铭文，并会在同一笔交易中返回。",
    ],
  },
  xverse: {
    name: "XVERSE",
    tips: [
      "Xverse 有两个地址：Payment（以 3… 或 bc1q… 开头）支付费用；Ordinals（bc1p…）必须持有 BITMAP。",
      "弹窗 2 从 Payment 地址付款，因此不会在那里看到 BITMAP。这是正常的。",
      "弹窗 3 会要求你为两个地址的输入签名。请全部批准，否则揭示交易无法包含你的 BITMAP。",
      "如果中途关闭页面，请打开“我的铭刻付款”；提交记录已保存，你无需再次付款即可继续。",
    ],
  },
};

const GUIDE_COPY = {
  en: { label: "HOW TO MINT · WALLET GUIDE", titleA: "THREE POPUPS.", titleB: "ONE GUARDIAN.", popup: "POPUP", safety: "SAFETY: THE APP CHECKS YOUR WALLET HOLDS THE BITMAP BEFORE ANY PAYMENT. IF THE CHECK FAILS, NOTHING IS PAID.", shared: SHARED, wallet: WALLET },
  zh: { label: "如何铭刻 · 钱包指南", titleA: "三个弹窗。", titleB: "一尊守护者。", popup: "弹窗", safety: "安全提示：付款前系统会确认你的钱包持有该 BITMAP。验证失败则不会产生任何付款。", shared: SHARED_ZH, wallet: WALLET_ZH },
};

export function WalletMintGuide({ lang = "en" }: { lang?: MintLang }) {
  const [w, setW] = useState<Wallet>("unisat");
  const copy = GUIDE_COPY[lang];
  return (
    <section className="panel mt-10 rounded-md border border-border p-5">
      <p className="label text-signal">{copy.label}</p>
      <h2 className="display mt-1 text-3xl">{copy.titleA} <span className="text-bitcoin">{copy.titleB}</span></h2>
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {copy.shared.map(([t, body], k) => (
          <li key={t} className="border border-border p-3">
            <p className="font-mono text-xs text-bitcoin">{copy.popup} {k + 1}</p>
            <p className="display text-lg">{t}</p>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex gap-2">
        {(Object.keys(copy.wallet) as Wallet[]).map((k) => (
          <button key={k} type="button" onClick={() => setW(k)} className={w === k ? "btn-term" : "btn-term-ghost"}>{copy.wallet[k].name}</button>
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {copy.wallet[w].tips.map((t) => (
          <li key={t} className="flex gap-2 text-sm"><span className="font-mono text-signal">›</span><span>{t}</span></li>
        ))}
      </ul>
      <p className="mt-4 font-mono text-[10px] text-muted-foreground">
        {copy.safety}
      </p>
    </section>
  );
}

const STORY = [
  ["READ FROM BITCOIN", "Every Guardian comes from one block: its hash, size, weight and transactions. Anyone with a node can rebuild the same creature — forever. That is Digital Matter."],
  ["GROWS WITH THE LAND", "The longer a BITMAP is held, the stronger its land boost — more visitor BIT and taller builds. A Guardian stationed there defends it, raids neighbours and brings spoils home."],
  ["A WORLD OTHERS SEE", "Send your Guardian on patrols and marches from the Command Centre. Every player in the Oasis sees it walking the same route, even when you're offline."],
  ["BEDROCK ANYONE CAN BUILD ON", "The Guardian generator is inscribed on-chain and every Guardian is a child of its BITMAP. Any builder can read them to make arenas, quests or games — no permission needed."],
] as const;

const STORY_ZH = [
  ["读取自比特币", "每尊守护者都来自一个真实区块：哈希、大小、重量和交易。任何运行节点的人都能永久重建出完全相同的生物——这就是数字物质。"],
  ["随土地共同成长", "BITMAP 持有越久，土地加成越强——访客 BIT 奖励更高，建筑高度上限也更高。驻守的守护者会保卫土地、突袭邻域并将战利品带回家。"],
  ["所有人都能看见的世界", "从指挥中心派遣守护者巡逻或行军。即使你离线，绿洲中的每位玩家也会看到它沿着同一条路线前进。"],
  ["任何人都能建设的基岩", "守护者生成器已铭刻上链，每尊守护者都是其 BITMAP 的子铭文。任何建设者都能读取它们，制作竞技场、任务或互动体验——无需许可。"],
] as const;

const STORY_COPY = {
  en: { label: "WHY IT MATTERS", titleA: "THE LAND WAKES UP.", titleB: "SO DO ITS GUARDIANS.", items: STORY },
  zh: { label: "为何重要", titleA: "土地正在苏醒。", titleB: "守护者亦然。", items: STORY_ZH },
};

export function GuardianStory({ lang = "en" }: { lang?: MintLang }) {
  const copy = STORY_COPY[lang];
  return (
    <section className="mt-10">
      <p className="label text-signal">{copy.label}</p>
      <h2 className="display mt-1 text-3xl">{copy.titleA} <span className="text-bitcoin">{copy.titleB}</span></h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {copy.items.map(([t, b], k) => (
          <div key={t} className="panel rounded-md border border-border p-4">
            <p className="font-mono text-xs text-bitcoin">0{k + 1}</p>
            <p className="display text-lg">{t}</p>
            <p className="mt-1 text-sm text-muted-foreground">{b}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
