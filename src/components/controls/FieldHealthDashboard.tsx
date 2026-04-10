"use client";

/**
 * FieldHealthDashboard — collapsible panel showing satellite pixel analysis.
 * Shows a health score, category distribution bar, and plain-language
 * Spanish recommendations derived from the current satellite image.
 */

import { useState } from "react";
import { useParcelContext } from "@/context/ParcelContext";
import { useFieldAnalysis } from "@/hooks/useFieldAnalysis";
import { es } from "@/lib/i18n/es";
import type { FieldCategory } from "@/types";

// SVG circle progress indicator
function ScoreCircle({ score }: { score: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 70 ? "#16a34a" : score >= 40 ? "#ca8a04" : "#dc2626";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
        <text
          x="36"
          y="40"
          textAnchor="middle"
          fontSize="16"
          fontWeight="bold"
          fill={color}
        >
          {Math.round(score)}
        </text>
      </svg>
      <span className="text-xs text-gray-500">{es.analysis.score}</span>
    </div>
  );
}

// Horizontal stacked bar
function DistributionBar({ categories }: { categories: FieldCategory[] }) {
  return (
    <div className="w-full h-4 flex rounded overflow-hidden">
      {categories.map((cat) => (
        <div
          key={cat.id}
          style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
          title={`${cat.label}: ${cat.percentage.toFixed(1)}%`}
        />
      ))}
    </div>
  );
}

// Category legend row
function CategoryRow({ cat }: { cat: FieldCategory }) {
  return (
    <div className="flex items-center justify-between text-xs gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: cat.color }}
        />
        <span className="text-gray-700 truncate">{cat.label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0 text-gray-500">
        <span>{cat.percentage.toFixed(1)}%</span>
        <span>{cat.hectares.toFixed(1)} {es.analysis.hectares}</span>
      </div>
    </div>
  );
}

export function FieldHealthDashboard() {
  const { selectedLayerType } = useParcelContext();
  const { analysis, loading, error } = useFieldAnalysis();
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 w-64 text-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
      >
        <span>{es.analysis.title}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-gray-100">
          {/* True-color notice */}
          {selectedLayerType === "true-color" && (
            <p className="text-gray-500 text-xs pt-3 leading-snug">
              {es.analysis.selectAnalysisLayer}
            </p>
          )}

          {/* Loading */}
          {selectedLayerType !== "true-color" && loading && (
            <p className="text-gray-400 text-xs pt-3">{es.analysis.loading}</p>
          )}

          {/* Error */}
          {selectedLayerType !== "true-color" && !loading && error && error !== "no-data" && (
            <p className="text-red-500 text-xs pt-3">{es.analysis.error}</p>
          )}

          {/* No data */}
          {selectedLayerType !== "true-color" && !loading && (error === "no-data" || (!analysis && !error)) && (
            <p className="text-gray-400 text-xs pt-3">{es.analysis.noData}</p>
          )}

          {/* Analysis results */}
          {analysis && !loading && (
            <>
              {/* Score + bar side by side */}
              <div className="flex items-center gap-3 pt-2">
                <ScoreCircle score={analysis.score} />
                <div className="flex-1 flex flex-col gap-2">
                  <span className="text-xs text-gray-500 font-medium">{es.analysis.distribution}</span>
                  <DistributionBar categories={analysis.categories} />
                </div>
              </div>

              {/* Category legend */}
              <div className="flex flex-col gap-1.5">
                {analysis.categories.map((cat) => (
                  <CategoryRow key={cat.id} cat={cat} />
                ))}
              </div>

              {/* Recommendations */}
              {analysis.recommendations.length > 0 && (
                <div className="border-t border-gray-100 pt-2">
                  <p className="text-xs font-semibold text-gray-700 mb-1">
                    {es.analysis.recommendations}
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {analysis.recommendations.map((rec, i) => (
                      <li key={i} className="flex gap-1.5 text-xs text-gray-600 leading-snug">
                        <span className="shrink-0 text-green-600 mt-0.5">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
