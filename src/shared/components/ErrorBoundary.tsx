import React from 'react';

interface State { failed: boolean }

/**
 * Last line of defence for the screen: if a component throws while rendering, the person sees a clear message
 * and a reload button instead of a blank page. The error itself is logged to the browser console for support.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('[ui] A screen failed to render:', error, info.componentStack);
  }

  render(): React.ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-8 text-center space-y-4">
          <h1 className="text-base font-bold text-slate-900">Something went wrong</h1>
          <p className="text-sm text-slate-600">This page could not be shown. Your data is safe. Reload the page to continue.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-9 px-4 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 cursor-pointer"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
