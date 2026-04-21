import React from 'react';
import { isRecoverableChunkError, recoverFromChunkError } from '../lib/chunkRecovery';

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

class AppErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error?.message || 'Unknown error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[RootErrorBoundary]', error, info.componentStack);

    if (isRecoverableChunkError(error)) {
      recoverFromChunkError();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-charcoal-solid flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-2xl card-charcoal flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl"></span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-white/55 text-sm mb-6">{this.state.message}</p>
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => {
                  this.setState({ hasError: false, message: '' });
                  window.location.href = '/';
                }}
                className="px-6 py-2.5 rounded-xl bg-charcoal hover:bg-charcoal text-white text-sm font-semibold transition-colors"
                type="button"
              >
                Reload App
              </button>
              <a
                href="/help"
                className="text-xs text-white/45 hover:text-white/70 transition-colors"
              >
                Need help? Contact Support
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
