import type { ReactNode } from "react";

export default function HoyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-md w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}
