import { Component, ErrorInfo, ReactNode } from 'react';
import { track } from '@/lib/analytics';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Sanitize error messages: remove UUIDs, JWT-like tokens, signed URLs.
function sanitizeMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '<jwt>')
    .replace(/https?:\/\/[^\s]+/g, '<url>')
    .slice(0, 500);
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    try {
      track('error_shown', {
        source: 'error_boundary',
        message: sanitizeMessage(error.message || 'unknown'),
        component_stack_present: Boolean(errorInfo?.componentStack),
      });
    } catch {
      // never let analytics break the boundary
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Algo deu errado</h1>
            <p className="text-muted-foreground mb-4">
              {this.state.error?.message || 'Erro desconhecido'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}