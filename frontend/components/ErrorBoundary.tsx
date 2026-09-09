import React from 'react';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * S3: a render crash used to leave an 11-year-old staring at a white screen with
 * no way out. This catches it, shows a friendly "something went wrong" card with
 * a reload button, and fires a one-shot report to the backend so the bug is
 * visible in the server log without anyone reporting it.
 *
 * NB: this project ships no @types/react, so `React.Component` is untyped here -
 * hence the explicit `declare` for props/state rather than generic type args.
 */
class ErrorBoundary extends React.Component {
  declare props: Props;
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    try {
      fetch(`${API_URL}/client-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          message: String(error?.message || error).slice(0, 2000),
          stack: String(error?.stack || info?.componentStack || '').slice(0, 8000),
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      }).catch(() => {});
    } catch {
      /* never let the reporter itself throw */
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-purple-100 via-indigo-100 to-blue-200">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="text-5xl mb-4" aria-hidden>🤔</div>
          <h1 className="text-2xl font-bold text-indigo-700 mb-2">Something went wrong</h1>
          <p className="text-gray-600 mb-6">
            MYRI hit a bump. Reloading the page usually fixes it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-md hover:bg-indigo-700 transition-colors"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
