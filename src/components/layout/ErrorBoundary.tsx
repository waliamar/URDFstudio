// src/components/layout/ErrorBoundary.tsx
// Panel-level error boundary. A render throw in one panel shows the error +
// stack inline instead of blanking the whole window, and surfaces the trace
// (which an uncaught render error would otherwise swallow).
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  /** Label shown in the fallback so we know which panel threw. */
  label: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ info });
    // Also log so it shows in the devtools console with the full stack.
    console.error(`[${this.props.label}] render error:`, error, info.componentStack);
  }

  render(): ReactNode {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary-title">{this.props.label} crashed</div>
        <pre className="error-boundary-body">
          {error.message}
          {"\n\n"}
          {error.stack ?? ""}
          {info?.componentStack ?? ""}
        </pre>
        <button onClick={() => this.setState({ error: null, info: null })}>
          Dismiss
        </button>
      </div>
    );
  }
}
