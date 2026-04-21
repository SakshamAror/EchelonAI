import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  label?: string;
}
interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="panel-box"
          style={{ borderColor: "var(--red)", marginBottom: 16 }}
        >
          <div
            className="panel-label"
            style={{
              color: "var(--red)",
              borderColor: "var(--red)",
              background: "rgba(255,76,76,0.08)",
            }}
          >
            {this.props.label ?? "Render Error"}
          </div>
          <p style={{ fontSize: 12, color: "var(--red)", lineHeight: 1.6, marginBottom: 12 }}>
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              background: "none",
              border: "1px solid var(--red)",
              color: "var(--red)",
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "5px 14px",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
