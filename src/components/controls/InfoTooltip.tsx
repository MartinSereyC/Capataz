"use client";

/**
 * InfoTooltip — a tiny accessible "?" help button that opens a small popover
 * on hover (desktop) or tap (mobile). No external dependencies; Tailwind only.
 *
 * Closes on outside click or Escape. Designed to live on the map, so it uses
 * a z-index above Leaflet controls.
 */

import { useEffect, useRef, useState } from "react";
import { es } from "@/lib/i18n/es";

interface InfoTooltipProps {
  title: string;
  body: string;
  /** Placement of the popover relative to the button. Default "bottom-right". */
  placement?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
}

export function InfoTooltip({ title, body, placement = "bottom-right" }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const popoverPosition =
    placement === "bottom-right"
      ? "top-full right-0 mt-2"
      : placement === "bottom-left"
        ? "top-full left-0 mt-2"
        : placement === "top-right"
          ? "bottom-full right-0 mb-2"
          : "bottom-full left-0 mb-2";

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={open ? es.tooltip.closeHelp : es.tooltip.openHelp}
        aria-expanded={open}
        className="flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 text-[10px] font-bold leading-none transition-colors shrink-0"
      >
        ?
      </button>

      {open && (
        <div
          role="tooltip"
          className={`absolute ${popoverPosition} w-60 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-xl border border-gray-200 p-3 z-[1100] pointer-events-auto`}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <p className="text-xs font-semibold text-gray-800 mb-1">{title}</p>
          <p className="text-[11px] text-gray-600 leading-snug">{body}</p>
        </div>
      )}
    </div>
  );
}
