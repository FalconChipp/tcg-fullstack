import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // devLog is ESM so we can't import it here — safe console in class components
    if (process.env.NODE_ENV !== "production") {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const { fallback, children } = this.props;

    if (!error) return children;

    if (fallback) {
      return typeof fallback === "function"
        ? fallback({ error, reset: this.handleReset })
        : fallback;
    }

    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <p className="text-sm font-semibold text-red-400">Something went wrong</p>
        <p className="max-w-sm text-xs text-vault-textTertiary">
          {error?.message || "An unexpected error occurred."}
        </p>
        <button
          type="button"
          onClick={this.handleReset}
          className="rounded-lg bg-red-500/15 px-4 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/25"
        >
          Try again
        </button>
      </div>
    );
  }
}
