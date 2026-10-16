import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[LexiFlow ErrorBoundary caught an error]:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ padding: '24px', margin: '20px 0', borderLeft: '4px solid #ef4444' }}>
          <h3 style={{ color: '#ef4444', marginBottom: '8px', fontSize: '16px', fontWeight: 600 }}>
            {this.props.fallbackTitle || 'Something went wrong'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginBottom: '16px' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred in this view.'}
          </p>
          <button className="btn-primary" onClick={this.handleReset} style={{ fontSize: '13px' }}>
            🔄 Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
