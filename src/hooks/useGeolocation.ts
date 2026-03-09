import { useState, useCallback } from "react";

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: false,
  });

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: "Geolocalização não suportada" }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          error: null,
          loading: false,
        });
      },
      (err) => {
        const messages: Record<number, string> = {
          1: "Permissão de localização negada",
          2: "Localização indisponível",
          3: "Tempo esgotado ao obter localização",
        };
        setState((s) => ({
          ...s,
          error: messages[err.code] || "Erro ao obter localização",
          loading: false,
        }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const distanceTo = useCallback(
    (targetLat: number, targetLng: number) => {
      if (state.latitude == null || state.longitude == null) return null;
      const R = 6371000;
      const dLat = ((targetLat - state.latitude) * Math.PI) / 180;
      const dLng = ((targetLng - state.longitude) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((state.latitude * Math.PI) / 180) *
          Math.cos((targetLat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },
    [state.latitude, state.longitude]
  );

  return { ...state, requestLocation, distanceTo };
}
