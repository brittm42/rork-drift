import { Platform } from "react-native";

export type MapKitPlace = {
  id: string;
  name: string;
  formattedAddress: string;
  category: string | null;
  latitude: number;
  longitude: number;
};

type CachedAccessToken = {
  token: string;
  expiresAt: number;
};

let tokenCache: CachedAccessToken | null = null;

async function exchangeAuthToken(authToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://maps-api.apple.com/v1/token", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) {
      console.log("[mapkit] token exchange failed:", res.status);
      return null;
    }
    const json = (await res.json()) as { accessToken?: string; expiresInSeconds?: number };
    if (!json.accessToken) return null;
    const ttl = (json.expiresInSeconds ?? 1800) * 1000;
    tokenCache = {
      token: json.accessToken,
      expiresAt: Date.now() + ttl - 60_000,
    };
    return json.accessToken;
  } catch (e) {
    console.log("[mapkit] exchange error:", e);
    return null;
  }
}

async function getAccessToken(authToken: string): Promise<string | null> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  return exchangeAuthToken(authToken);
}

export async function searchPlaces(
  query: string,
  authToken: string | null,
  opts?: { userLatitude?: number; userLongitude?: number }
): Promise<MapKitPlace[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  if (!authToken) {
    console.log("[mapkit] no token configured");
    return [];
  }
  if (Platform.OS === "web") {
    console.log("[mapkit] web not supported for search");
    return [];
  }
  try {
    const access = await getAccessToken(authToken);
    if (!access) return [];
    const params = new URLSearchParams({ q: trimmed, lang: "en-US" });
    if (opts?.userLatitude != null && opts?.userLongitude != null) {
      params.set(
        "userLocation",
        `${opts.userLatitude},${opts.userLongitude}`
      );
      params.set("searchLocation", `${opts.userLatitude},${opts.userLongitude}`);
    }
    const res = await fetch(
      `https://maps-api.apple.com/v1/search?${params.toString()}`,
      { headers: { Authorization: `Bearer ${access}` } }
    );
    if (res.status === 401) {
      tokenCache = null;
      return [];
    }
    if (!res.ok) {
      console.log("[mapkit] search failed:", res.status);
      return [];
    }
    const json = (await res.json()) as {
      results?: Array<{
        name?: string;
        formattedAddressLines?: string[];
        structuredAddress?: { fullThoroughfare?: string; locality?: string; administrativeArea?: string };
        poiCategory?: string;
        coordinate?: { latitude: number; longitude: number };
      }>;
    };
    const results = json.results ?? [];
    return results
      .filter((r) => r.coordinate)
      .map((r, idx) => ({
        id: `mk_${idx}_${r.coordinate!.latitude}_${r.coordinate!.longitude}`,
        name: r.name ?? "Unnamed place",
        formattedAddress:
          r.formattedAddressLines?.join(", ") ??
          [
            r.structuredAddress?.fullThoroughfare,
            r.structuredAddress?.locality,
            r.structuredAddress?.administrativeArea,
          ]
            .filter(Boolean)
            .join(", ") ??
          "",
        category: r.poiCategory ?? null,
        latitude: r.coordinate!.latitude,
        longitude: r.coordinate!.longitude,
      }));
  } catch (e) {
    console.log("[mapkit] search error:", e);
    return [];
  }
}
