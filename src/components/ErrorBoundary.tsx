"use client";

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-md p-8 max-w-sm w-full text-center">
            <h1 className="text-xl font-semibold text-gray-800 mb-2">Algo salió mal</h1>
            <p className="text-sm text-gray-500 mb-6">
              Ocurrió un error inesperado. Puedes reintentar o volver al inicio.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
              >
                Reintentar
              </button>
              <a
                href="/"
                className="px-5 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Volver al inicio
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
