"use client";

import { es } from "@/lib/i18n/es";
import type { ProgressStep } from "@/types";

interface ProgressStepsProps {
  steps: ProgressStep[];
}

const statusStyles = {
  pending: "bg-gray-200 text-gray-400",
  active: "bg-green-100 text-green-700 animate-pulse",
  done: "bg-green-600 text-white",
  error: "bg-red-100 text-red-600",
};

const lineStyles = {
  pending: "bg-gray-200",
  active: "bg-green-200",
  done: "bg-green-600",
  error: "bg-red-200",
};

export function ProgressSteps({ steps }: ProgressStepsProps) {
  return (
    <div className="w-full max-w-md mx-auto space-y-3">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center gap-3">
          {/* Step indicator */}
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${statusStyles[step.status]}`}
          >
            {step.status === "done" ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : step.status === "error" ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              step.order
            )}
          </div>

          {/* Step label */}
          <span
            className={`text-sm transition-colors duration-300 ${
              step.status === "active"
                ? "text-green-700 font-semibold"
                : step.status === "done"
                  ? "text-gray-500"
                  : step.status === "error"
                    ? "text-red-600 font-semibold"
                    : "text-gray-400"
            }`}
          >
            {step.label}
          </span>

          {/* Connecting line (not on last step) */}
          {i < steps.length - 1 && (
            <div className="flex-1 hidden" />
          )}
        </div>
      ))}
    </div>
  );
}

/** Create the 4 default progress steps */
export function createProgressSteps(): ProgressStep[] {
  return [
    { id: "extract", label: es.progress.extracting, status: "pending", order: 1 },
    { id: "locate", label: es.progress.locating, status: "pending", order: 2 },
    { id: "imagery", label: es.progress.loading, status: "pending", order: 3 },
    { id: "ready", label: es.progress.ready, status: "pending", order: 4 },
  ];
}
