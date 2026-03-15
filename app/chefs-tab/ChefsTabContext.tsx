"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { RestaurantId } from "@/lib/sophia-weekly/restaurants";
import { RESTAURANT_IDS, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";

const STORAGE_KEY = "sophiaWeeklyRestaurant";

const ChefsTabContext = createContext<{
  restaurantId: RestaurantId;
  setRestaurantId: (id: RestaurantId) => void;
}>({
  restaurantId: DEFAULT_RESTAURANT_ID,
  setRestaurantId: () => {},
});

export function ChefsTabProvider({ children }: { children: React.ReactNode }) {
  const [restaurantId, setRestaurantIdState] = useState<RestaurantId>(DEFAULT_RESTAURANT_ID);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && RESTAURANT_IDS.includes(stored as RestaurantId)) {
      setRestaurantIdState(stored as RestaurantId);
    }
  }, []);

  const setRestaurantId = (id: RestaurantId) => {
    setRestaurantIdState(id);
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  };

  return (
    <ChefsTabContext.Provider value={{ restaurantId, setRestaurantId }}>
      {children}
    </ChefsTabContext.Provider>
  );
}

export function useChefsTab() {
  return useContext(ChefsTabContext);
}
