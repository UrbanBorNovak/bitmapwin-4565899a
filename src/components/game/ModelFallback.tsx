import { Component, type ReactNode } from "react";

/** Shows `fallback` when an on-chain model fails to load instead of crashing the world. */
export class ModelFallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error) {
    console.warn("On-chain model unavailable, using fallback", error.message);
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
