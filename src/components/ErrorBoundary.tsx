import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error | null;
}

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, ErrorBoundaryState> {
  constructor(props: {}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    // Force a reload of the component tree (simple strategy)
    // You may replace with more targeted state management if needed
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, backgroundColor: '#fff5f5', color: '#7f1d1d', borderRadius: 4, border: '1px solid #fecaca' }}>
          <h3 style={{ marginTop: 0 }}>에러가 발생했습니다.</h3>
          <p style={{ margin: '8px 0' }}>{this.state.error?.message || '알 수 없는 오류가 발생했습니다.'}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={this.handleRetry}>다시 시도</button>
            <button className="btn" onClick={() => this.setState({ hasError: false, error: null })}>무시</button>
          </div>
        </div>
      );
    }

  return this.props.children as React.ReactNode;
  }
}
