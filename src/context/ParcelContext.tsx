"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Parcel, ParcelSource, AppState } from "@/types";

interface ParcelContextValue extends AppState {
  setParcel: (parcel: Parcel, source: ParcelSource) => void;
  setDates: (dates: string[], cloudCoverage: Record<string, number>) => void;
  setSelectedDate: (date: string) => void;
  setSentinelToken: (token: string) => void;
  reset: () => void;
}

const initialState: AppState = {
  parcel: null,
  parcelSource: "auto",
  availableDates: [],
  cloudCoverage: {},
  selectedDate: null,
  sentinelToken: null,
};

const ParcelContext = createContext<ParcelContextValue | null>(null);

export function ParcelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);

  const setParcel = useCallback((parcel: Parcel, source: ParcelSource) => {
    setState((prev) => ({ ...prev, parcel, parcelSource: source }));
  }, []);

  const setDates = useCallback(
    (dates: string[], cloudCoverage: Record<string, number>) => {
      setState((prev) => ({
        ...prev,
        availableDates: dates,
        cloudCoverage,
        selectedDate: dates.length > 0 ? dates[dates.length - 1] : null,
      }));
    },
    [],
  );

  const setSelectedDate = useCallback((date: string) => {
    setState((prev) => ({ ...prev, selectedDate: date }));
  }, []);

  const setSentinelToken = useCallback((token: string) => {
    setState((prev) => ({ ...prev, sentinelToken: token }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <ParcelContext.Provider
      value={{
        ...state,
        setParcel,
        setDates,
        setSelectedDate,
        setSentinelToken,
        reset,
      }}
    >
      {children}
    </ParcelContext.Provider>
  );
}

export function useParcelContext() {
  const ctx = useContext(ParcelContext);
  if (!ctx) {
    throw new Error("useParcelContext must be used within a ParcelProvider");
  }
  return ctx;
}
