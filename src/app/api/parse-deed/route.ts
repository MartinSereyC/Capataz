/**
 * POST /api/parse-deed
 * Receives a PDF multipart/form-data upload, extracts coordinates,
 * converts to WGS84, and returns a Parcel JSON object.
 *
 * Rate limit: 10 requests per minute per IP.
 */

import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPDF } from "@/lib/pdf/extract-text";
import { parseCoordinates } from "@/lib/pdf/parse-coordinates";
import { utmPairsToWGS84 } from "@/lib/geo/utm-converter";
import { buildPolygon } from "@/lib/geo/polygon-builder";
import { validateCoordinates } from "@/lib/geo/validation";
import { RATE_LIMIT, UPLOAD_LIMITS } from "@/lib/constants";
import type { Parcel, ParseDeedResponse } from "@/types";

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter (Map<ip, timestamp[]>)
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT.windowMs;

  const timestamps = (rateLimitMap.get(ip) ?? []).filter(
    (t) => t > windowStart
  );

  if (timestamps.length >= RATE_LIMIT.maxRequests) {
    rateLimitMap.set(ip, timestamps);
    return true;
  }

  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse<ParseDeedResponse>> {
  // Rate limiting
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      {
        success: false,
        error: "RATE_LIMIT_EXCEEDED",
        message:
          "Demasiadas solicitudes. Por favor espere un momento antes de intentar nuevamente.",
      },
      { status: 429 }
    );
  }

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "INVALID_REQUEST",
        message: "No se pudo leer el formulario. Asegúrese de enviar un archivo PDF.",
      },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      {
        success: false,
        error: "NO_FILE",
        message: "No se encontró ningún archivo en la solicitud.",
      },
      { status: 400 }
    );
  }

  // Validate file type
  if (!UPLOAD_LIMITS.acceptedTypes.includes(file.type as "application/pdf")) {
    return NextResponse.json(
      {
        success: false,
        error: "INVALID_FILE_TYPE",
        message: "Solo se aceptan archivos PDF.",
      },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > UPLOAD_LIMITS.maxSizeBytes) {
    return NextResponse.json(
      {
        success: false,
        error: "FILE_TOO_LARGE",
        message: `El archivo supera el tamaño máximo permitido de ${UPLOAD_LIMITS.maxSizeMB} MB.`,
      },
      { status: 400 }
    );
  }

  // Extract text from PDF
  let extractedText: string;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    extractedText = await extractTextFromPDF(buffer);
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "PDF_PARSE_ERROR",
        message:
          "No se pudo leer el archivo PDF. Verifique que el archivo no esté dañado.",
      },
      { status: 422 }
    );
  }

  // Parse coordinates from extracted text
  const parsed = parseCoordinates(extractedText);
  if (!parsed) {
    return NextResponse.json(
      {
        success: false,
        error: "NO_COORDINATES_FOUND",
        message:
          "No se encontraron coordenadas en el documento. Puede dibujar los límites de su terreno manualmente en el mapa.",
        extracted_text_preview: extractedText.slice(0, 500),
      },
      { status: 422 }
    );
  }

  // Convert UTM to WGS84 if needed
  let wgs84Pairs: [number, number][];
  if (parsed.format === "UTM_18S" || parsed.format === "UTM_19S") {
    if (!parsed.utmZone) {
      return NextResponse.json(
        {
          success: false,
          error: "UTM_ZONE_UNKNOWN",
          message:
            "No se pudo determinar la zona UTM del documento.",
        },
        { status: 422 }
      );
    }
    try {
      wgs84Pairs = utmPairsToWGS84(parsed.rawPairs, parsed.utmZone);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "COORDINATE_CONVERSION_ERROR",
          message:
            "Error al convertir las coordenadas UTM. Verifique el formato del documento.",
        },
        { status: 422 }
      );
    }
  } else {
    // Already in WGS84 [lng, lat]
    wgs84Pairs = parsed.rawPairs;
  }

  // Validate coordinates are within Chile
  const validation = validateCoordinates(wgs84Pairs);
  if (!validation.valid) {
    return NextResponse.json(
      {
        success: false,
        error: "COORDINATES_OUTSIDE_CHILE",
        message: `Las coordenadas están fuera de los límites de Chile: ${validation.errors.join(", ")}`,
      },
      { status: 422 }
    );
  }

  // Build polygon
  let polygonResult;
  try {
    polygonResult = buildPolygon(wgs84Pairs);
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "POLYGON_BUILD_ERROR",
        message:
          "No se pudo construir el polígono del terreno. Se necesitan al menos 3 coordenadas válidas.",
      },
      { status: 422 }
    );
  }

  const parcel: Parcel = {
    coordinates: wgs84Pairs,
    polygon: polygonResult.polygon,
    bbox: polygonResult.bboxGeoJSON,
    area_hectares: polygonResult.area_hectares,
    coordinate_format_detected: parsed.format,
    utm_zone_detected: parsed.utmZone,
    raw_coordinates: parsed.rawString,
  };

  return NextResponse.json({ success: true, parcel });
}
