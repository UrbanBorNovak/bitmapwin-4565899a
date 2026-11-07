import { GuideTrail } from "@/components/GuideTrail";
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { GUARDIAN_PRICE_SATS } from "@/lib/bitmon";

export const Route = createFileRoute("/guardians-guide")({
  head: () => ({
    meta: [
      { title: "What Are Guardians? — BITMAPWIN" },
      { name: "description", content: "Learn what DMT Guardians are and how to summon and inscribe one from any BITMAP — in English and 中文." },
      { property: "og:title", content: "What Are Guardians? — BITMAPWIN" },
      { property: "og:description", content: "Every BITMAP grows one Guardian, read straight from its Bitcoin block. Learn how to summon and inscribe yours." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GuardiansGuidePage,
});

type Lang = "en" | "zh";

const COPY = {
  en: {
    crumb: "BITMAPWIN / GUIDE",
    titleA: "WHAT ARE",
    titleB: "GUARDIANS?",
    intro:
      "A Guardian is a creature read straight from a Bitcoin block. Nothing about it is invented — its armor, size, crests and eyes all come from real block data. This is Digital Matter Theory (DMT): anyone with a Bitcoin node can read the same block and get the exact same Guardian.",
    factsTitle: "READ FROM THE BLOCK",
    facts: [
      ["ARMOR", "Comes from the block's mining difficulty. Harder blocks grow heavier armor."],
      ["SIZE", "Comes from the block's weight. Heavy blocks grow Titans; light ones grow ethereal Wraiths."],
      ["CRESTS", "Come from fork signals — Taproot and SegWit era blocks wear special crests."],
      ["EYES", "Blocks with unusually lucky hashes (extra leading zeroes) grow laser Super-Zero eyes."],
    ],
    rulesTitle: "THE THREE RULES",
    rules: [
      "ONE BLOCK, ONE GUARDIAN — every BITMAP can grow exactly one Guardian, ever.",
      "READ, NOT INVENTED — the same block always produces the same Guardian, for everyone, forever.",
      "YOURS ON-CHAIN — once inscribed, the Guardian is a real Ordinal in your own wallet. Nobody can take it.",
    ],
    howTitle: "HOW TO GET ONE",
    steps: [
      ["01", "PICK A BITMAP", "Go to the summon page and type any block number — for example 715093. You'll see a live 3D preview of the Guardian that block grows."],
      ["02", "SUMMON IN THE OASIS", `Pay ${GUARDIAN_PRICE_SATS.toLocaleString("en-US")} sats. After one confirmation your Guardian wakes up and starts patrolling its BITMAP in the Oasis world.`],
      ["03", "INSCRIBE ON-CHAIN", "Once it's awake, inscribe it as a real Ordinal child of its BITMAP. It lands in your own wallet — and only inscribed Guardians can be listed on the market."],
    ],
    cta: "◆ SUMMON A GUARDIAN",
    ctaMarket: "BROWSE THE COLLECTION →",
    ctaTracker: "◆ GUARDIAN TRACKER",

    faqTitle: "QUESTIONS",
    faq: [
      ["Does it cost anything to look?", "No. Previewing any block's Guardian is free — you only pay if you summon it."],
      ["What does the summon fee do?", "The 1,000-sat fee wakes the Guardian in the Oasis. Inscribing on-chain is a separate step with its own network fee."],
      ["Can two people summon the same block?", "No. The first confirmed summon wins — one block, one Guardian."],
      ["What is the shielded experiment?", "An optional research path that sends your Guardian into a private pool instead of your wallet. It's unaudited — only try it if you want to be part of the first shielded DMT."],
      ["Where do I track my Guardian?", "Open the Guardian Tracker from the summon page's MY SUMMONS tab. It shows each of your Guardians' confirmed block, era, level, phase and DNA stats, and refreshes on its own as the chain moves."],
    ],

  },
  zh: {
    crumb: "BITMAPWIN / 指南",
    titleA: "什么是",
    titleB: "守护者?",
    intro:
      "守护者是一只直接从比特币区块中读取的生物。它的一切都不是虚构的——护甲、体型、冠饰和眼睛全部来自真实的区块数据。这就是数字物质理论(DMT):任何运行比特币节点的人读取同一个区块,都会得到完全相同的守护者。",
    factsTitle: "从区块中读取",
    facts: [
      ["护甲", "来自区块的挖矿难度。难度越高的区块,长出的护甲越重。"],
      ["体型", "来自区块的重量。重的区块长出泰坦;轻的区块长出飘渺的幽灵。"],
      ["冠饰", "来自分叉信号——Taproot 和 SegWit 时代的区块会佩戴特殊的冠饰。"],
      ["眼睛", "拥有罕见幸运哈希(额外前导零)的区块会长出超零激光眼。"],
    ],
    rulesTitle: "三条规则",
    rules: [
      "一个区块,一只守护者——每个 BITMAP 永远只能长出一只守护者。",
      "读取而非虚构——同一个区块对任何人、任何时候都产生同一只守护者。",
      "链上属于你——一旦铭刻,守护者就是你钱包中真正的序数铭文,无人能夺走。",
    ],
    howTitle: "如何获得一只",
    steps: [
      ["01", "选择一个 BITMAP", "前往召唤页面,输入任意区块号——例如 715093。你会看到该区块长出的守护者的实时 3D 预览。"],
      ["02", "在绿洲中召唤", `支付 ${GUARDIAN_PRICE_SATS.toLocaleString("en-US")} sats。经过一个区块确认后,你的守护者就会苏醒,并开始在绿洲世界中巡逻它的 BITMAP。`],
      ["03", "链上铭刻", "守护者苏醒后,将它铭刻为其 BITMAP 的真正序数子铭文。它会进入你自己的钱包——只有铭刻过的守护者才能在市场上架。"],
    ],
    cta: "◆ 召唤一只守护者",
    ctaMarket: "浏览收藏系列 →",
    ctaTracker: "◆ 守护者追踪面板",

    faqTitle: "常见问题",
    faq: [
      ["预览需要付费吗?", "不需要。预览任何区块的守护者都是免费的——只有召唤时才需要支付。"],
      ["召唤费用有什么用?", "1,000 sats 的费用让守护者在绿洲中苏醒。链上铭刻是单独的步骤,需要额外支付网络费用。"],
      ["两个人能召唤同一个区块吗?", "不能。第一个确认的召唤获胜——一个区块,一只守护者。"],
      ["什么是屏蔽实验?", "一条可选的研究路径,将你的守护者送入隐私池而不是你的钱包。它未经审计——只有当你想成为第一批屏蔽 DMT 的参与者时才尝试。"],
      ["在哪里追踪我的守护者?", "在召唤页面的“我的召唤”标签中打开守护者追踪面板。它会显示你每只守护者的确认区块、纪元、等级、阶段和 DNA 属性,并随着链上变化自动刷新。"],
    ],

  },
} as const;

function GuardiansGuidePage() {
  const [lang, setLang] = useState<Lang>("en");
  const c = COPY[lang];

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 md:px-8" data-no-translate>
      <div className="flex items-center justify-between gap-3">
        <p className="label text-signal">{c.crumb}</p>
        <div className="flex gap-1 font-mono text-[11px]">
          {(["en", "zh"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`border px-3 py-1.5 ${lang === l ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground"}`}
            >
              {l === "en" ? "EN" : "中文"}
            </button>
          ))}
        </div>
      </div>

      <h1 className="display mt-2 text-4xl md:text-5xl">
        {c.titleA} <span className="text-bitcoin">{c.titleB}</span>
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{c.intro}</p>

      <section className="panel mt-8 rounded-md border border-border">
        <header className="border-b border-border p-4">
          <p className="label text-bitcoin">{c.factsTitle}</p>
        </header>
        <div className="grid sm:grid-cols-2">
          {c.facts.map(([k, v], i) => (
            <div key={k} className={`p-4 ${i % 2 === 1 ? "sm:border-l sm:border-border" : ""} ${i > 1 ? "border-t border-border" : ""}`}>
              <p className="display text-lg text-bitcoin">{k}</p>
              <p className="mt-1 text-sm text-muted-foreground">{v}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel mt-6 rounded-md border border-signal/40 p-4">
        <p className="label text-signal">{c.rulesTitle}</p>
        <ul className="mt-2 space-y-2">
          {c.rules.map((r) => (
            <li key={r} className="font-mono text-[12px] leading-relaxed text-muted-foreground">
              <span className="text-bitcoin">▸</span> {r}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <p className="label text-bitcoin">{c.howTitle}</p>
        <ol className="mt-3 grid gap-3 md:grid-cols-3">
          {c.steps.map(([n, t, note]) => (
            <li key={n} className="panel rounded-md border border-border p-4">
              <p className="font-mono text-xs text-bitcoin">{n}</p>
              <p className="display mt-1 text-lg">{t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{note}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <p className="label text-bitcoin">{c.faqTitle}</p>
        <div className="mt-3 space-y-2">
          {c.faq.map(([q, a]) => (
            <details key={q} className="panel rounded-md border border-border p-4">
              <summary className="display cursor-pointer text-base">{q}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/mint" className="btn-term">{c.cta}</Link>
        <Link to="/collections/guardians" className="btn-term-ghost">{c.ctaMarket}</Link>
        <Link to="/ownership" hash="value-loop" className="btn-term-ghost">{lang === "en" ? "THE SOVEREIGN VALUE LOOP →" : "主权价值循环 →"}</Link>
        <Link to="/mint" search={{ tab: "mine" }} hash="guardian-tracker" className="btn-term-ghost">{c.ctaTracker}</Link>

      </div>
      <GuideTrail current="/guardians-guide" />
    </div>
  );
}
