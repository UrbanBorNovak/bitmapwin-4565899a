/**
 * Step-by-step summon tutorial: what actually happens, in order, with the real
 * amounts and the safety checks, so a new user understands summoning before
 * they ever reach the inscribe step.
 */
import { useState } from "react";
import { GUARDIAN_PRICE_SATS } from "@/lib/bitmon";
import { TRIBUTE_SATS } from "@/lib/guardian-delegate";
import type { MintLang } from "@/lib/mint-lang";

type Step = {
  key: string;
  title: string;
  short: string;
  body: string;
  bullets: string[];
  cost?: string;
};

const STEPS_EN: Step[] = [
  {
    key: "pick",
    title: "PICK A BLOCK",
    short: "Choose any Bitcoin block — every block grows exactly one Guardian.",
    body:
      "Type any block number into the console and press PREVIEW, or roll a random one. Its Guardian is read straight from the block's real hash, size, weight and transactions — the same block always makes the same Guardian, forever. Looking around costs nothing.",
    bullets: [
      "The 3D preview and its HP / BITE / SPEED / ARMOR bars are free to browse.",
      "If the block already has a Guardian, the console says so — each block has only one, so roll another.",
      "You pay nothing until step 3.",
    ],
  },
  {
    key: "wallet",
    title: "CONNECT A WALLET",
    short: "Your wallet must hold <height>.bitmap — the app checks BEFORE any payment.",
    body:
      "Connect UniSat or Xverse with the account that holds the BITMAP you want to wake. The app verifies your wallet actually holds <height>.bitmap before any payment is created. If the check fails, the summon stops and NOTHING WAS PAID.",
    bullets: [
      "UNISAT: use one Taproot (bc1p…) account that holds the BITMAP.",
      "XVERSE: the Ordinals address (bc1p…) must hold the BITMAP; the Payment address only pays fees.",
      "The summon never moves your BITMAP — it stays in your wallet the whole time.",
    ],
  },
  {
    key: "summon",
    title: "PAY THE SUMMON",
    short: `One payment of ${GUARDIAN_PRICE_SATS.toLocaleString("en-US")} sats to the treasury wakes it.`,
    body:
      "Press SUMMON and your wallet shows one normal payment — no inscription is involved yet. Scan the QR code from a phone wallet if you prefer. This payment wakes the Guardian in the app; it is not the on-chain inscription.",
    bullets: [
      `Amount: exactly ${GUARDIAN_PRICE_SATS.toLocaleString("en-US")} sats, plus the small miner fee your wallet sets.`,
      "One popup, one payment — if you see more, close it and start again.",
      "Already paid but the page froze? The console remembers your order — reopening the summon resumes it instead of charging twice.",
    ],
    cost: `${GUARDIAN_PRICE_SATS.toLocaleString("en-US")} SATS`,
  },
  {
    key: "awake",
    title: "WAIT FOR ONE CONFIRMATION",
    short: "About 10 minutes. Then it awakes on its BITMAP in the Oasis.",
    body:
      "After one Bitcoin confirmation the Guardian wakes up on <height>.bitmap in the Oasis. Every player can see it patrolling the land — with you or without you. The console flips to 'ALREADY AWAKE IN THE OASIS' automatically.",
    bullets: [
      "While waiting, the panel polls the payment — leave the tab open or come back later.",
      "Once awake, you can watch it in the Oasis or command it from the Command Centre (/command).",
      "Awake is not inscribed: it lives in the app until step 5.",
    ],
  },
  {
    key: "inscribe",
    title: "INSCRIBE ON-CHAIN",
    short: "Optional, separate, and locked until the summon confirmed.",
    body:
      "Only after the summon confirms does the inscribe panel unlock. Inscribing creates a real Ordinal child of your BITMAP in your own wallet, so it joins the on-chain collection and becomes listable. Your wallet will show a small funding payment (the commit), then the reveal — where your BITMAP is spent and returned to you in the same transaction.",
    bullets: [
      "Popups: SUMMON was step 3; the COMMIT is a small ~2,000-sat funding payment; the REVEAL returns your BITMAP to your own address and mints the 546-sat Guardian child.",
      `A ${TRIBUTE_SATS.toLocaleString("en-US")}-sat treasury tribute is paid inside the reveal.`,
      "The full popup-by-popup walkthrough for UniSat and Xverse is in the WALLET GUIDE tab.",
    ],
    cost: `+${TRIBUTE_SATS.toLocaleString("en-US")} SATS TRIBUTE`,
  },
];

const STEPS_ZH: Step[] = [
  {
    key: "pick",
    title: "选择一个区块",
    short: "选择任意比特币区块——每个区块只孕育一尊守护者。",
    body: "在控制台输入任意区块高度并点击“预览”，也可以随机选择。守护者直接读取该区块真实的哈希、大小、重量和交易数据——同一区块永远生成同一尊守护者。浏览完全免费。",
    bullets: [
      "你可以免费查看 3D 预览及生命、攻击、速度和护甲数据。",
      "如果该区块已有守护者，控制台会提示你；每个区块仅有一尊，请选择其他区块。",
      "在第 3 步之前无需支付任何费用。",
    ],
  },
  {
    key: "wallet",
    title: "连接钱包",
    short: "钱包必须持有 <高度>.bitmap——付款前会先验证。",
    body: "使用持有目标 BITMAP 的账户连接 UniSat 或 Xverse。系统会在创建任何付款前验证钱包确实持有 <高度>.bitmap。验证失败时召唤立即停止，不会产生任何付款。",
    bullets: [
      "UNISAT：使用持有该 BITMAP 的 Taproot（bc1p…）账户。",
      "XVERSE：Ordinals 地址（bc1p…）必须持有 BITMAP；Payment 地址仅用于支付费用。",
      "召唤不会转移你的 BITMAP——它会始终留在你的钱包中。",
    ],
  },
  {
    key: "summon",
    title: "支付召唤费用",
    short: `向金库支付一次 ${GUARDIAN_PRICE_SATS.toLocaleString("en-US")} 聪即可唤醒守护者。`,
    body: "点击“召唤”后，钱包会显示一笔普通付款——此时尚未进行铭刻。你也可以使用手机钱包扫描二维码。该付款只负责在应用中唤醒守护者，并不是链上铭文。",
    bullets: [
      `金额：准确支付 ${GUARDIAN_PRICE_SATS.toLocaleString("en-US")} 聪，另加钱包设置的少量矿工费。`,
      "一次弹窗，一笔付款——如果看到更多付款请求，请关闭并重新开始。",
      "已经付款但页面中断？控制台会记住订单；重新打开即可继续，不会重复收费。",
    ],
    cost: `${GUARDIAN_PRICE_SATS.toLocaleString("en-US")} 聪`,
  },
  {
    key: "awake",
    title: "等待一次确认",
    short: "约 10 分钟后，它会在绿洲中的 BITMAP 上觉醒。",
    body: "获得一次比特币确认后，守护者会在绿洲的 <高度>.bitmap 上觉醒。所有玩家都能看到它巡逻，无论你是否在线。控制台会自动变为“已在绿洲中觉醒”。",
    bullets: [
      "等待期间面板会自动查询付款；你可以保持页面打开，也可以稍后回来。",
      "觉醒后，你可以在绿洲观看它，或前往指挥中心（/command）下达命令。",
      "觉醒不等于铭刻：完成第 5 步前，它只存在于应用中。",
    ],
  },
  {
    key: "inscribe",
    title: "链上铭刻",
    short: "这是独立的可选步骤，召唤确认后才会解锁。",
    body: "召唤确认后，铭刻面板才会解锁。铭刻会在你的钱包中创建一个真实的 Ordinal，并成为你的 BITMAP 的子铭文，因此它会加入链上合集并可供交易。钱包先显示一笔小额注资付款（Commit），随后显示揭示交易（Reveal）；你的 BITMAP 会在揭示交易中支出并原路返回。",
    bullets: [
      "弹窗顺序：第 3 步是召唤；COMMIT 是约 2,000 聪的小额注资；REVEAL 会把 BITMAP 返回你的地址，并铸造一枚 546 聪的守护者子铭文。",
      `揭示交易内会向金库支付 ${TRIBUTE_SATS.toLocaleString("en-US")} 聪贡金。`,
      "UniSat 与 Xverse 的完整逐弹窗说明，请查看“钱包指南”标签页。",
    ],
    cost: `+${TRIBUTE_SATS.toLocaleString("en-US")} 聪贡金`,
  },
];

const TUTORIAL_COPY = {
  en: {
    label: "SUMMON TUTORIAL · FIRST TIME HERE",
    titleA: "FIVE STEPS.", titleB: "ONE GUARDIAN.",
    summary: `SUMMON = ${GUARDIAN_PRICE_SATS.toLocaleString("en-US")} SATS · INSCRIBE = SEPARATE, LATER, OPTIONAL`,
    intro: (height: number) => `New to Guardians? This is exactly what happens when you summon one on ${height}.bitmap — in order, with the real costs. Nothing is paid before the wallet checks pass.`,
    safety: "SAFETY: THE APP CHECKS YOUR WALLET HOLDS THE BITMAP BEFORE ANY PAYMENT. IF THE CHECK FAILS, NOTHING IS PAID. YOUR BITMAP IS NEVER MOVED BY THE SUMMON ITSELF.",
    steps: STEPS_EN,
  },
  zh: {
    label: "召唤教程 · 初次体验",
    titleA: "五个步骤。", titleB: "一尊守护者。",
    summary: `召唤 = ${GUARDIAN_PRICE_SATS.toLocaleString("en-US")} 聪 · 铭刻 = 独立、稍后、可选`,
    intro: (height: number) => `第一次接触守护者？这里按真实顺序与实际费用说明如何在 ${height}.bitmap 上召唤。钱包验证通过前不会产生任何付款。`,
    safety: "安全提示：付款前系统会确认你的钱包持有该 BITMAP。验证失败则不会付款。召唤本身绝不会转移你的 BITMAP。",
    steps: STEPS_ZH,
  },
};

export function SummonTutorial({ height, lang = "en" }: { height: number; lang?: MintLang }) {
  const [open, setOpen] = useState<string | null>("pick");
  const copy = TUTORIAL_COPY[lang];
  return (
    <section className="panel rounded-md border border-border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="label text-signal">{copy.label}</p>
          <h2 className="display mt-1 text-3xl">
            {copy.titleA} <span className="text-bitcoin">{copy.titleB}</span>
          </h2>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">
          {copy.summary}
        </p>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        {copy.intro(height)}
      </p>

      <ol className="mt-4 space-y-2">
        {copy.steps.map((s, i) => {
          const active = open === s.key;
          return (
            <li key={s.key} className={`border ${active ? "border-bitcoin/60 bg-background" : "border-border"}`}>
              <button
                type="button"
                onClick={() => setOpen(active ? null : s.key)}
                aria-expanded={active}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                <span className={`font-mono text-xs ${active ? "text-bitcoin" : "text-muted-foreground"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="display flex-1 text-base">{s.title}</span>
                <span className="hidden font-mono text-[10px] text-muted-foreground sm:block">{s.short}</span>
                {s.cost ? (
                  <span className="hidden border border-bitcoin/50 px-1.5 py-0.5 font-mono text-[9px] text-bitcoin md:block">
                    {s.cost}
                  </span>
                ) : null}
                <span className={`font-mono text-xs ${active ? "text-bitcoin" : "text-muted-foreground"}`}>
                  {active ? "−" : "+"}
                </span>
              </button>
              {active ? (
                <div className="border-t border-border px-3 pb-3 pt-2">
                  <p className="max-w-3xl text-sm text-muted-foreground">{s.body}</p>
                  <ul className="mt-2 space-y-1.5">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex gap-2 text-xs">
                        <span className="font-mono text-signal">›</span>
                        <span className="text-muted-foreground">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <p className="mt-4 font-mono text-[10px] text-muted-foreground">
        {copy.safety}
      </p>
    </section>
  );
}
