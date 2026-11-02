import { useEffect, useState } from "react";

export type MintLang = "en" | "zh";
const KEY = "bitmapwin:mint-lang";
const EVT = "mint-lang";

/** Device-local EN / 中文 toggle shared by the mint page sections. */
export function useMintLang(): [MintLang, (l: MintLang) => void] {
  const [lang, setLang] = useState<MintLang>("en");
  useEffect(() => {
    const read = () => setLang(localStorage.getItem(KEY) === "zh" ? "zh" : "en");
    read();
    window.addEventListener(EVT, read);
    return () => window.removeEventListener(EVT, read);
  }, []);
  const set = (l: MintLang) => {
    localStorage.setItem(KEY, l);
    window.dispatchEvent(new Event(EVT));
  };
  return [lang, set];
}

export const MINT_COPY = {
  en: {
    heroTag: "OFFICIAL ON-CHAIN COLLECTION · ONE GUARDIAN PER BLOCK, FOREVER",
    heroA: "EVERY INSCRIPTION",
    heroB: "JOINS THE COLLECTION.",
    heroBody: "Each Guardian is inscribed as a child of your BITMAP and of the BITMAPWIN master parent, so it counts in the collection automatically — provable by anyone with a node.",
    awakened: "AWAKENED",
    inscribedOnChain: "INSCRIBED ON-CHAIN",
    formula: "[YOUR BITMAP] + [MASTER PARENT] → [YOUR GUARDIAN]",
    latest: "LATEST:",
    inscribed: "◆ INSCRIBED",
    awake: "AWAKE",
    console: "MINT CONSOLE",
    titleA: "Pick a block.",
    titleB: "Meet its Guardian.",
    preview: "PREVIEW",
    random: "⟳ RANDOM",
    readErr: "✕ COULD NOT READ THIS BLOCK — TRY AGAIN",
    reading: "> READING BLOCK DNA…",
    ability: "ABILITY",
    line: "LINE",
    alreadyAwake: "● ALREADY AWAKE IN THE OASIS",
    oneEach: "Each block has one Guardian. Try another block.",
    rollAnother: "ROLL ANOTHER →",
    viewOnChain: "VIEW ON-CHAIN",
    available: "● READY TO AWAKEN",
    summon: "◆ AWAKEN GUARDIAN",
    sats: "SATS",
    summonNote: (h: number) => `Awakening brings it to life in the Oasis. Then inscribe it as a child of ${h}.bitmap and the BITMAPWIN master — it joins the collection automatically.`,
    pickBegin: "Pick a block to begin.",
    steps: [
      ["01", "PICK A BITMAP", "Every block grows one Guardian. Armor from difficulty, size from block weight, crests from fork signals — read, not invented."],
      ["02", "AWAKEN IN THE OASIS", (p: string) => `Pay ${p} sats. After one confirmation your Guardian wakes up and patrols its BITMAP in the Oasis.`],
      ["03", "INSCRIBE ON-CHAIN", "Inscribe your awake Guardian as a real Ordinal child of its BITMAP. It lands in your own wallet — or try the shielded experiment."],
    ] as const,
    step3: "STEP 03 · INSCRIBE ON-CHAIN",
    inscribeFrom: "Inscribe from",
    checking: "> CHECKING AWAKENING STATUS…",
    locked: "🔒 LOCKED · AWAKEN THIS GUARDIAN FIRST",
    lockedBody: "Inscribing opens once the awakening payment confirms and the Guardian wakes in the Oasis.",
    inscribeBtn: "◆ INSCRIBE ON-CHAIN",
    alreadyInscribed: "✓ ALREADY INSCRIBED ON-CHAIN",
    viewInscription: "VIEW INSCRIPTION →",
    confirmed: "Awakening confirmed. A tiny on-chain child that borrows the master generator. It lands in your own wallet.",
    tabs: { inscribe: "QUICK INSCRIBE", tutorial: "AWAKEN TUTORIAL", tour: "GUARDIAN TOUR", wallet: "WALLET GUIDE", story: "THE STORY", mine: "MY AWAKENINGS", scout: "SCOUT MY BITMAPS" },
    guide: "GUIDE", payments: "MY PAYMENTS", morph: "MORPH LAB", pool: "POOL NOTES",
    expTitle: "◇ EXPERIMENT · FIRST SHIELDED DMT",
    expBody: "Optional: send your Guardian into a private pool instead of your wallet. Your browser holds the only key. Unaudited research.",
  },
  zh: {
    heroTag: "官方链上合集 · 每个区块一尊守护者，永久唯一",
    heroA: "每一次铭刻",
    heroB: "都自动加入合集。",
    heroBody: "每尊守护者都以你的 BITMAP 和 BITMAPWIN 主父铭文的子铭文形式铭刻，因此会自动计入合集——任何运行节点的人都能验证。",
    awakened: "已觉醒",
    inscribedOnChain: "已链上铭刻",
    formula: "[你的 BITMAP] + [主父铭文] → [你的守护者]",
    latest: "最新：",
    inscribed: "◆ 已铭刻",
    awake: "已觉醒",
    console: "铸造控制台",
    titleA: "选择一个区块，",
    titleB: "遇见它的守护者。",
    preview: "预览",
    random: "⟳ 随机",
    readErr: "✕ 无法读取该区块——请重试",
    reading: "> 正在读取区块 DNA…",
    ability: "能力",
    line: "血统",
    alreadyAwake: "● 已在绿洲中觉醒",
    oneEach: "每个区块只有一尊守护者。请尝试其他区块。",
    rollAnother: "换一个 →",
    viewOnChain: "链上查看",
    available: "● 可召唤",
    summon: "◆ 召唤",
    sats: "聪",
    summonNote: (h: number) => `召唤会让它在绿洲中觉醒。之后将其铭刻为 ${h}.bitmap 与 BITMAPWIN 主铭文的子铭文——自动加入合集。`,
    pickBegin: "选择一个区块开始。",
    steps: [
      ["01", "选择 BITMAP", "每个区块孕育一尊守护者。护甲来自难度，体型来自区块重量，冠饰来自分叉信号——全部读取自链上，绝非虚构。"],
      ["02", "在绿洲中召唤", (p: string) => `支付 ${p} 聪。一次确认后，你的守护者将觉醒并巡逻它的 BITMAP。`],
      ["03", "链上铭刻", "将已觉醒的守护者铭刻为其 BITMAP 的真实 Ordinal 子铭文，直接进入你自己的钱包——或尝试隐私实验。"],
    ] as const,
    step3: "第 03 步 · 链上铭刻",
    inscribeFrom: "铭刻自",
    checking: "> 正在检查召唤状态…",
    locked: "🔒 已锁定 · 请先召唤这尊守护者",
    lockedBody: "召唤付款确认且守护者在绿洲中觉醒后，即可开启铭刻。",
    inscribeBtn: "◆ 链上铭刻",
    alreadyInscribed: "✓ 已链上铭刻",
    viewInscription: "查看铭文 →",
    confirmed: "召唤已确认。一个借用主生成器的微型链上子铭文，将直接进入你自己的钱包。",
    tabs: { inscribe: "快速铭刻", tutorial: "召唤教程", tour: "守护者巡礼", wallet: "钱包指南", story: "背景故事", mine: "我的召唤", scout: "侦察我的 BITMAP" },
    guide: "指南", payments: "我的付款", morph: "形态实验室", pool: "隐私池笔记",
    expTitle: "◇ 实验 · 首个隐私 DMT",
    expBody: "可选：将守护者送入私密池而非你的钱包。只有你的浏览器持有密钥。未经审计的研究功能。",
  },
};

export function MintLangToggle({ lang, setLang }: { lang: MintLang; setLang: (l: MintLang) => void }) {
  return (
    <div data-no-translate className="inline-flex overflow-hidden rounded-sm border border-border font-mono text-[10px]">
      {(["en", "zh"] as const).map((l) => (
        <button key={l} type="button" onClick={() => setLang(l)}
          className={`px-2 py-1 ${lang === l ? "bg-bitcoin text-background" : "text-muted-foreground hover:text-foreground"}`}>
          {l === "en" ? "EN" : "中文"}
        </button>
      ))}
    </div>
  );
}
