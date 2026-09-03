/**
 * Whole-site machine translation.
 *
 * Rather than maintaining hand-written dictionaries for every page, the app
 * keeps its English source and translates the rendered text of the page into
 * the chosen language. Translations are cached in the browser and in the
 * database, so repeat visits are instant and cost nothing.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { translateStringsFn } from "@/lib/translate.functions";

export const LANGUAGES = [
  { code: "en", label: "ENGLISH", short: "EN" },
  { code: "el", label: "ΕΛΛΗΝΙΚΑ", short: "EL" },
  { code: "es", label: "ESPAÑOL", short: "ES" },
  { code: "de", label: "DEUTSCH", short: "DE" },
  { code: "ru", label: "РУССКИЙ", short: "RU" },
  { code: "hi", label: "हिन्दी", short: "HI" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

const STORAGE_KEY = "bmu-lang";
const CACHE_PREFIX = "bmu-tr-";

type Ctx = {
  lang: LangCode;
  setLang: (lang: LangCode) => void;
  translating: boolean;
};

const LanguageContext = createContext<Ctx>({ lang: "en", setLang: () => {}, translating: false });

export function useLanguage() {
  return useContext(LanguageContext);
}

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "CODE",
  "PRE",
  "TEXTAREA",
  "CANVAS",
  "SVG",
  "PATH",
  "TITLE",
]);

/** Skip data-like strings: numbers, addresses, txids, tickers. */
function isTranslatable(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 2 || t.length > 600) return false;
  if (!/[A-Za-z]{2}/.test(t)) return false;
  if (/^[\d\s.,:%+\-–—/()$]+$/.test(t)) return false;
  if (/^[0-9a-f]{16,}$/i.test(t)) return false;
  if (/^(bc1|tb1)[a-z0-9]{20,}$/i.test(t)) return false;
  if (/^[A-Za-z0-9]{26,}$/.test(t)) return false;
  if (/\.bitmap$/i.test(t)) return false;
  // Live on-chain data rows (addresses, block references) stay as-is.
  if (/bc1|tb1|BLK\s|\btxid\b/i.test(t) && /[\d]/.test(t)) return false;
  return true;
}

function loadCache(lang: LangCode): Record<string, string> {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + lang);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveCache(lang: LangCode, cache: Record<string, string>) {
  try {
    localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(cache));
  } catch {
    /* quota — cache stays in memory only */
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");
  const [translating, setTranslating] = useState(false);
  const originals = useRef(new WeakMap<Text, string>());
  const cache = useRef<Record<string, string>>({});
  const pending = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as LangCode | null;
    if (stored && LANGUAGES.some((l) => l.code === stored)) setLangState(stored);
  }, []);

  const setLang = useCallback((next: LangCode) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  // Collect the visible text nodes of the page, remembering their English source.
  const collect = useCallback(() => {
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;
    while (node) {
      const parent = node.parentElement;
      const current = node;
      node = walker.nextNode() as Text | null;
      if (!parent) continue;
      if (SKIP_TAGS.has(parent.tagName)) continue;
      if (parent.closest("[data-no-translate]")) continue;
      const source = originals.current.get(current) ?? current.nodeValue ?? "";
      if (!isTranslatable(source)) continue;
      if (!originals.current.has(current)) originals.current.set(current, source);
      nodes.push(current);
    }
    return nodes;
  }, []);

  const restore = useCallback(() => {
    for (const node of collect()) {
      const source = originals.current.get(node);
      if (source && node.nodeValue !== source) node.nodeValue = source;
    }
  }, [collect]);

  const apply = useCallback(
    (nodes: Text[], map: Record<string, string>) => {
      for (const node of nodes) {
        const source = originals.current.get(node);
        if (!source) continue;
        const trimmed = source.trim();
        const hit = map[trimmed] ?? cache.current[trimmed];
        if (!hit) continue;
        const lead = source.slice(0, source.indexOf(trimmed));
        const tail = source.slice(source.indexOf(trimmed) + trimmed.length);
        const next = `${lead}${hit}${tail}`;
        if (node.nodeValue !== next) node.nodeValue = next;
      }
    },
    [],
  );

  const run = useCallback(async () => {
    if (lang === "en" || pending.current) return;
    const nodes = collect();
    if (nodes.length === 0) return;
    apply(nodes, {});

    const missing = Array.from(
      new Set(
        nodes
          .map((n) => (originals.current.get(n) ?? "").trim())
          .filter((s) => s && !cache.current[s]),
      ),
    );
    if (missing.length === 0) return;

    pending.current = true;
    setTranslating(true);
    try {
      for (let i = 0; i < missing.length; i += 100) {
        const batch = missing.slice(i, i + 100);
        const map = await translateStringsFn({ data: { lang, texts: batch } });
        cache.current = { ...cache.current, ...map };
        saveCache(lang, cache.current);
        apply(collect(), map);
      }
    } catch {
      /* leave English in place when translation is unavailable */
    } finally {
      pending.current = false;
      setTranslating(false);
    }
  }, [apply, collect, lang]);

  // Language switch: restore English, then translate with the cached dictionary.
  useEffect(() => {
    document.documentElement.lang = lang;
    if (lang === "en") {
      cache.current = {};
      restore();
      return;
    }
    cache.current = loadCache(lang);
    void run();
  }, [lang, restore, run]);

  // Keep newly rendered content translated (route changes, live data).
  useEffect(() => {
    if (lang === "en") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      if (pending.current) return;
      clearTimeout(timer);
      timer = setTimeout(() => void run(), 450);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [lang, run]);

  const value = useMemo(() => ({ lang, setLang, translating }), [lang, setLang, translating]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
