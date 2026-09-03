import { useEffect, useRef, useState } from "react";
import { Languages } from "lucide-react";
import { LANGUAGES, useLanguage } from "@/lib/i18n";

/** Header control that switches the whole site into another language. */
export function LanguageSwitcher() {
  const { lang, setLang, translating } = useLanguage();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const active = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={box} data-no-translate>
      <button
        type="button"
        aria-label="Change language"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 items-center gap-1 border border-border px-2 text-muted-foreground transition-colors hover:border-primary hover:text-foreground md:h-9"
      >
        <Languages className="size-4" />
        <span className="font-mono text-[10px] uppercase">
          {translating ? "…" : active.short}
        </span>
      </button>

      {open && (
        <ul className="absolute right-0 top-full z-50 mt-1 min-w-40 border border-border bg-background">
          {LANGUAGES.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                onClick={() => {
                  setLang(l.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 font-mono text-[11px] uppercase transition-colors hover:bg-muted ${
                  l.code === lang ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <span>{l.label}</span>
                <span className="text-bitcoin">{l.short}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
