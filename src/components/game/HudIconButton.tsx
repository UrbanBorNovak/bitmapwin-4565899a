/**
 * Icon-only HUD control.
 *
 * Every in-world control is a square hairline tile with a single line icon —
 * no written labels. The meaning is carried by the icon plus an accessible
 * label that doubles as the hover/long-press tooltip, so the HUD reads the
 * same in every language.
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "title"> & {
  /** Spoken + tooltip text, e.g. "Attack (F)". */
  label: string;
  icon: ReactNode;
  active?: boolean;
  /** Small corner dot — used for "something is waiting here". */
  flag?: boolean;
  large?: boolean;
};

export function hudTileClass(active = false, large = false) {
  return [
    "pointer-events-auto relative grid place-items-center border bg-background/60 backdrop-blur-sm transition-colors",
    large ? "size-11" : "size-9",
    active
      ? "border-bitcoin bg-bitcoin/15 text-bitcoin"
      : "border-border text-muted-foreground hover:border-bitcoin hover:text-bitcoin",
    "disabled:opacity-40 disabled:hover:border-border disabled:hover:text-muted-foreground",
  ].join(" ");
}

export function HudIconButton({ label, icon, active, flag, large, ...rest }: Props) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={active} className={hudTileClass(active, large)} {...rest}>
      <span className="grid place-items-center [&_svg]:size-[1.15rem]" aria-hidden>
        {icon}
      </span>
      {flag ? <span className="absolute right-0.5 top-0.5 size-1.5 bg-bitcoin" aria-hidden /> : null}
    </button>
  );
}

/** Same tile, rendered as a link (used for the ranks board). */
export function HudIconLink({
  label,
  icon,
  href,
  external,
}: {
  label: string;
  icon: ReactNode;
  href: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={hudTileClass()}
    >
      <span className="grid place-items-center [&_svg]:size-[1.15rem]" aria-hidden>
        {icon}
      </span>
    </a>
  );
}
