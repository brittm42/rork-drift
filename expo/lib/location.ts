import * as Location from "expo-location";
import { Platform } from "react-native";

export type GeocodeHit = {
  address: string;
  latitude: number;
  longitude: number;
};

export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === "web") {
    if (typeof navigator !== "undefined" && navigator.geolocation) return true;
    return false;
  }
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === "granted";
  } catch (e) {
    console.log("[location] permission error:", e);
    return false;
  }
}

export async function getCurrentLocation(): Promise<GeocodeHit | null> {
  try {
    if (Platform.OS === "web") {
      if (typeof navigator === "undefined" || !navigator.geolocation) return null;
      return await new Promise<GeocodeHit | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              address: "Current location",
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          },
          (err) => {
            console.log("[location] web current error:", err?.message);
            resolve(null);
          },
          { timeout: 8000 }
        );
      });
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const [addr] = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    const line = addr
      ? [
          [addr.streetNumber, addr.street].filter(Boolean).join(" "),
          addr.city,
          addr.region,
        ]
          .filter(Boolean)
          .join(", ")
      : "Current location";
    return {
      address: line || "Current location",
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    };
  } catch (e) {
    console.log("[location] current error:", e);
    return null;
  }
}

export async function geocodeAddress(query: string): Promise<GeocodeHit | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  if (Platform.OS === "web") {
    return { address: trimmed, latitude: 0, longitude: 0 };
  }
  try {
    const results = await Location.geocodeAsync(trimmed);
    if (!results || results.length === 0) return null;
    const hit = results[0];
    return {
      address: trimmed,
      latitude: hit.latitude,
      longitude: hit.longitude,
    };
  } catch (e) {
    console.log("[location] geocode error:", e);
    return null;
  }
}
