"use client";

import { es } from "@/lib/i18n/es";
import { UploadZone } from "@/components/upload/UploadZone";
import { ProgressSteps } from "@/components/upload/ProgressSteps";
import { useParcelUpload } from "@/hooks/useParcelUpload";

export default function HomePage() {
  const { state, steps, errorMessage, upload, reset } = useParcelUpload();

  const isUploading = state === "uploading";
  const isError = state === "error";

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Hero */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            {es.landing.hero}
          </h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            {es.landing.subtitle}
          </p>
        </div>

        {/* Upload or Progress */}
        {isUploading || isError ? (
          <div className="space-y-6">
            <ProgressSteps steps={steps} />

            {/* Error message with retry and manual draw option */}
            {isError && errorMessage && (
              <div className="max-w-md mx-auto space-y-3">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{errorMessage}</p>
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    type="button"
                    onClick={reset}
                    className="px-5 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Intentar de nuevo
                  </button>
                  <a
                    href="/resultado"
                    className="px-5 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    {es.extraction.drawManually}
                  </a>
                </div>
              </div>
            )}
          </div>
        ) : (
          <UploadZone onFileSelected={upload} disabled={isUploading} />
        )}

        {/* How it works */}
        <div className="pt-8 border-t border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">
            {es.landing.howItWorks}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            {[
              { num: "1", text: es.landing.step1 },
              { num: "2", text: es.landing.step2 },
              { num: "3", text: es.landing.step3 },
              { num: "4", text: es.landing.step4 },
            ].map((step) => (
              <div
                key={step.num}
                className="flex items-start gap-3 p-4 rounded-lg bg-gray-50"
              >
                <span className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {step.num}
                </span>
                <p className="text-gray-700">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
