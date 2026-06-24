import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TravelCity {
  name:    string;
  display: string;
  lat:     number;
  lng:     number;
}

interface TravelStore {
  travelCity: TravelCity | null;
  setTravelCity: (city: TravelCity | null) => void;
  clearTravel:   () => void;
}

/** Store persistido: ciudad de viaje activa sobreescribe GPS en Feed y NearbyUsers. */
export const useTravelStore = create<TravelStore>()(
  persist(
    (set) => ({
      travelCity:    null,
      setTravelCity: (city) => set({ travelCity: city }),
      clearTravel:   ()     => set({ travelCity: null }),
    }),
    { name: "aura-travel-city" }
  )
);
