import { useEffect, useRef, useState } from "react";
import { discoveryApi } from "@/lib/api";

interface Coords { lat: number; lng: number; }

export function useGeolocation() {
  const [coords, setCoords]   = useState<Coords | null>(null);
  const [denied, setDenied]   = useState(false);
  const sent                  = useRef(false);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      pos => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        if (!sent.current) {
          sent.current = true;
          discoveryApi.updateLocation(c.lat, c.lng).catch(() => {});
        }
      },
      () => setDenied(true),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  return { coords, denied };
}
