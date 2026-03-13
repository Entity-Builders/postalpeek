import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { analytics } from '../lib/analytics';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary that captures render errors and sends them to PostHog.
 * Shows a minimal, on-brand fallback UI instead of a blank page.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    analytics.captureError(error, {
      component_stack: errorInfo.componentStack,
      handler: 'ErrorBoundary',
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className='w-screen h-screen flex flex-col items-center justify-center bg-[#e6e2da] px-6 text-center'>
          <span className='text-4xl mb-4'>🎨</span>
          <h1 className='font-serif text-2xl text-stone-800 mb-2'>
            Something went wrong
          </h1>
          <p className='text-stone-500 text-sm max-w-[360px] mb-6'>
            The postcard got lost in the mail. Try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className='px-5 py-2.5 bg-stone-800 text-white text-sm rounded-full hover:bg-stone-700 transition-colors'
          >
            Refresh
          </button>
          {this.state.error && (
            <p className='mt-6 text-[10px] text-stone-400 font-mono max-w-[400px] truncate'>
              {this.state.error.message}
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
