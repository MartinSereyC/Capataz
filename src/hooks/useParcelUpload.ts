"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useParcelContext } from "@/context/ParcelContext";
import { createProgressSteps } from "@/components/upload/ProgressSteps";
import type { ProgressStep, ParseDeedResponse, SatelliteDatesResponse } from "@/types";

type UploadState = "idle" | "uploading" | "done" | "error";

interface UseParcelUploadReturn {
  state: UploadState;
  steps: ProgressStep[];
  errorMessage: string | null;
  upload: (file: File) => Promise<void>;
  reset: () => void;
}

function updateStep(
  steps: ProgressStep[],
  stepId: string,
  status: ProgressStep["status"],
): ProgressStep[] {
  return steps.map((s) => (s.id === stepId ? { ...s, status } : s));
}

export function useParcelUpload(): UseParcelUploadReturn {
  const router = useRouter();
  const { setParcel, setDates } = useParcelContext();
  const [state, setState] = useState<UploadState>("idle");
  const [steps, setSteps] = useState<ProgressStep[]>(createProgressSteps);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      setState("uploading");
      setErrorMessage(null);
      const freshSteps = createProgressSteps();
      setSteps(freshSteps);

      try {
        // Step 1: Extract coordinates
        setSteps((s) => updateStep(s, "extract", "active"));

        const formData = new FormData();
        formData.append("file", file);

        const parseRes = await fetch("/api/parse-deed", {
          method: "POST",
          body: formData,
        });

        const parseData: ParseDeedResponse = await parseRes.json();

        if (!parseData.success) {
          setSteps((s) => updateStep(s, "extract", "error"));
          setErrorMessage(parseData.message ?? "Error al extraer coordenadas.");
          setState("error");
          // Still navigate to resultado so user can draw manually
          router.push("/resultado");
          return;
        }

        setSteps((s) => updateStep(s, "extract", "done"));

        // Step 2: Locate parcel on map
        setSteps((s) => updateStep(s, "locate", "active"));
        setParcel(parseData.parcel, "auto");
        setSteps((s) => updateStep(s, "locate", "done"));

        // Step 3: Load satellite imagery dates
        setSteps((s) => updateStep(s, "imagery", "active"));

        const bbox = parseData.parcel.bbox;
        const now = new Date();
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const datesRes = await fetch(
          `/api/satellite-dates?bbox=${bbox.join(",")}&from=${sixMonthsAgo.toISOString().split("T")[0]}&to=${now.toISOString().split("T")[0]}`,
        );

        if (datesRes.ok) {
          const datesData: SatelliteDatesResponse = await datesRes.json();
          setDates(datesData.dates, datesData.cloud_coverage);
        }

        setSteps((s) => updateStep(s, "imagery", "done"));

        // Step 4: Ready
        setSteps((s) => updateStep(s, "ready", "done"));
        setState("done");

        // Navigate to results
        router.push("/resultado");
      } catch (err) {
        setSteps((s) => {
          const activeStep = s.find((step) => step.status === "active");
          if (activeStep) return updateStep(s, activeStep.id, "error");
          return s;
        });
        setErrorMessage("Error de conexión. Verifique su internet e intente nuevamente.");
        setState("error");
      }
    },
    [router, setParcel, setDates],
  );

  const reset = useCallback(() => {
    setState("idle");
    setSteps(createProgressSteps());
    setErrorMessage(null);
  }, []);

  return { state, steps, errorMessage, upload, reset };
}
