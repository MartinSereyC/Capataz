/**
 * Sentinel Hub OAuth2 client credentials flow.
 * Caches the token server-side for ~55 minutes, then refreshes.
 */

import { SENTINEL_CONFIG } from "@/lib/constants";
import { isMockMode, MOCK_TOKEN } from "@/lib/sentinel/mock";
import type { SentinelTokenResponse } from "@/types";

interface TokenCache {
  token: string;
  expiresAt: number;
}

// Module-level cache — lives for the lifetime of the server process
let tokenCache: TokenCache | null = null;

/**
 * Returns a valid Sentinel Hub access token.
 * In mock mode: returns the dummy token immediately.
 * In live mode: fetches (or returns cached) a real OAuth2 token.
 */
export async function getSentinelToken(): Promise<SentinelTokenResponse> {
  if (isMockMode()) {
    return { token: MOCK_TOKEN, expires_in: 3600 };
  }

  const now = Date.now();

  // Return cached token if still valid
  if (tokenCache && now < tokenCache.expiresAt) {
    return { token: tokenCache.token, expires_in: Math.floor((tokenCache.expiresAt - now) / 1000) };
  }

  const clientId = process.env.SENTINEL_HUB_CLIENT_ID?.trim();
  const clientSecret = process.env.SENTINEL_HUB_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("SENTINEL_HUB_CLIENT_ID and SENTINEL_HUB_CLIENT_SECRET must be set in environment variables");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(SENTINEL_CONFIG.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Sentinel token request failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };

  // Cache for tokenCacheMs (55 minutes) instead of the full expires_in
  tokenCache = {
    token: data.access_token,
    expiresAt: now + SENTINEL_CONFIG.tokenCacheMs,
  };

  return { token: data.access_token, expires_in: data.expires_in };
}
