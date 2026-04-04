import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Unexpected rendering error.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep a console trace for browser debugging when runtime payloads are malformed.
    console.error('TheosGenealogia runtime render error:', error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f2e8] p-6 text-[#1f2937]">
        <div className="w-full max-w-2xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="mb-2 text-xl font-semibold">Rendering Error Recovered</h1>
          <p className="mb-2 text-sm text-slate-700">
            The interface hit a runtime payload issue. Refresh and retry with a narrower query if this
            persists.
          </p>
          <p className="text-sm text-red-700">{this.state.message}</p>
        </div>
      </div>
    );
  }
}

