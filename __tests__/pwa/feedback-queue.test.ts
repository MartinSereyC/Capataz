import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { encolarFeedback, leerCola, vaciarCola } from "@/lib/pwa/feedback-queue";

describe("feedback-queue (IndexedDB)", () => {
  beforeEach(async () => {
    await vaciarCola();
  });

  it("encolar → leer devuelve el item", async () => {
    const item = { url: "/api/feedback", body: { zonaId: "z1", valor: 3 }, timestamp: 1000 };
    await encolarFeedback(item);
    const cola = await leerCola();
    expect(cola).toHaveLength(1);
    expect(cola[0].body).toEqual(item.body);
    expect(cola[0].url).toBe("/api/feedback");
  });

  it("vaciar deja la cola vacía", async () => {
    await encolarFeedback({ url: "/api/feedback", body: { zonaId: "z2" }, timestamp: 2000 });
    await vaciarCola();
    const cola = await leerCola();
    expect(cola).toHaveLength(0);
  });

  it("múltiples items se preservan en orden", async () => {
    await encolarFeedback({ url: "/api/feedback", body: { n: 1 }, timestamp: 1 });
    await encolarFeedback({ url: "/api/feedback", body: { n: 2 }, timestamp: 2 });
    await encolarFeedback({ url: "/api/feedback", body: { n: 3 }, timestamp: 3 });
    const cola = await leerCola();
    expect(cola).toHaveLength(3);
    expect((cola[0].body as { n: number }).n).toBe(1);
    expect((cola[2].body as { n: number }).n).toBe(3);
  });
});
