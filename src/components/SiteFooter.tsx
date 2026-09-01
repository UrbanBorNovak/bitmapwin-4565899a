export function SiteFooter() {
  return (
    <footer className="border-t border-border px-4 py-8 md:px-8">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="display text-sm">THE LAND LAYER OF BITCOIN</div>
        <div className="label">
          REAL BLOCKS · LIVE ORDINALS · ON-CHAIN OWNERSHIP
          <span className="blink ml-2 text-foreground">_</span>
        </div>
      </div>
    </footer>
  );
}
