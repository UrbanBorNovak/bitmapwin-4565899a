import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class OasisWorldGuard extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Oasis renderer failed", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="grid h-[78vh] min-h-[520px] place-items-center border border-border bg-background px-5 text-center" role="alert">
        <div className="max-w-md">
          <p className="label text-bitcoin">OASIS SIGNAL LOST</p>
          <h1 className="display mt-3 text-2xl">THE 3D WORLD COULD NOT START</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Your browser may have blocked 3D graphics. Continue through the Atlas, or reload and choose Low graphics quality.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link to="/map" className="btn-term">OPEN 2D ATLAS</Link>
            <button type="button" className="btn-term-ghost" onClick={() => window.location.reload()}>RETRY OASIS</button>
          </div>
        </div>
      </section>
    );
  }
}