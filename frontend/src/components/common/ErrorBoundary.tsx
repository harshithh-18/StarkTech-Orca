/**
 * Containment.
 *
 * Owner: D · Phase: P4
 *
 * React unmounts the *entire tree* when a render throws and nothing catches it. That is
 * how a single bad call inside Leaflet — a `flyTo` with a NaN zoom, from a map whose
 * container was still hidden — turned into a blank white page with no message, on every
 * screen narrower than 768px.
 *
 * The map is third-party code drawing third-party tiles from four different servers. It is
 * exactly the part of this application most likely to throw, and the part the rest of the
 * app least needs in order to be useful: an answer with its verdict and its evidence is
 * still a good answer with no map beside it.
 *
 * So the map gets a boundary, and the failure costs the user the map instead of the page.
 * The fallback says what broke and offers a retry rather than showing an apologetic
 * shrug — and it logs, because a swallowed error nobody can see is worse than a crash.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** What failed, in the user's words: "the map", "the chart". */
  label: string;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept loud. Degrading gracefully is not the same as failing silently, and the one
    // place this must never happen unnoticed is during a rehearsal.
    console.error(`ORCA: ${this.props.label} failed`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="grid h-full place-items-center bg-slate-50 p-6 dark:bg-abyss-950">
        <div className="max-w-sm text-center">
          <p className="text-[13.5px] font-semibold text-slate-900 dark:text-slate-100">
            {this.props.label} stopped working
          </p>
          <p className="mt-1 text-[12px] leading-relaxed muted">
            Everything else on this page is still live. The details are in the browser
            console.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="btn-ghost mt-3 px-3 py-1.5"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
