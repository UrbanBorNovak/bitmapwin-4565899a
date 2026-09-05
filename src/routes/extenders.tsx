import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/extenders")({
  component: ExtendersLayout,
});

function ExtendersLayout() {
  return (
    <div>
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-[1600px] items-baseline justify-between gap-4 px-4 py-4 md:px-8">
          <Link to="/extenders" className="label hover:text-foreground">
            EXTENDERS /
          </Link>
          <span className="label">PACKAGES THAT DEPLOY ONTO PERMANENT LAND</span>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
