import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { OtherthingsBadge } from "@/components/OtherthingsBadge";

export const Route = createFileRoute("/collections")({
  component: CollectionsLayout,
});

function CollectionsLayout() {
  return (
    <div className="overflow-x-clip">
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-baseline justify-between gap-4 px-4 py-4 md:px-8">
          <Link to="/collections" className="label hover:text-foreground">
            COLLECTIONS /
          </Link>
          <OtherthingsBadge child="Collections" />
          <span className="label">CLUBS ARE DEFINED BY BLOCK HEIGHT RANGE</span>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
