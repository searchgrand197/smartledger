import { useQuery } from "@tanstack/react-query";
import { portalApi } from "@/api/portal";

export function usePortalDashboard() {
  return useQuery({
    queryKey: ["customer-portal-dashboard"],
    queryFn: () => portalApi.dashboard().then((r) => r.data),
  });
}
