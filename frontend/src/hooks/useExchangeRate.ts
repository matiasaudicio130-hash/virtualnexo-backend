import { useQuery } from "@tanstack/react-query";
import { exchangeApi, pricingApi } from "@/lib/api";
import type { ExchangeRate, PricingResponse } from "@/types";

export function useDolarBlue() {
  return useQuery<ExchangeRate>({
    queryKey: ["dolar-blue"],
    queryFn: async () => (await exchangeApi.dolarBlue()).data,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 10,
  });
}

export function usePricingPlans() {
  return useQuery<PricingResponse>({
    queryKey: ["pricing-plans"],
    queryFn: async () => (await pricingApi.plans()).data,
    staleTime: 1000 * 60 * 5,
  });
}

export function formatARS(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
