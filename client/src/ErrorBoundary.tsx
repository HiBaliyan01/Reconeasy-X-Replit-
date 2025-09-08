import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message?: string };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, message: error?.message || String(error) };
  }

  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error('App crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui' }}>
          <h2>Something went wrong.</h2>
          <p style={{ color: '#666' }}>{this.state.message}</p>
          <button onClick={() => (window.location.href = '/')} style={{ marginTop: 12 }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

