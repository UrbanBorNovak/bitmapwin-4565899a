import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MyBitmapsPanel } from "@/components/MyBitmapsPanel";

/** Marketplace entry: opens the seller inventory + bulk pricing flow in a drawer, without leaving the page. */
export function BulkSellDrawer() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="btn-term min-h-11" data-testid="bulk-sell-open">◆ BULK LIST / SELL</button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-3xl">
        <SheetHeader className="border-b border-border p-4 text-left">
          <SheetTitle className="display">BULK LIST / SELL</SheetTitle>
          <SheetDescription className="font-mono text-[10px]">
            SELECT YOUR BITMAPS · FAIR EV PRICING BY DEFAULT · YOU APPROVE EACH LISTING IN YOUR WALLET
          </SheetDescription>
        </SheetHeader>
        <div className="p-3">
          <MyBitmapsPanel />
        </div>
      </SheetContent>
    </Sheet>
  );
}
