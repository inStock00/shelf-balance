import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const FEATURE_KEYS = ["inventory", "accounting", "reports", "pos", "purchases"] as const;
export type FeatureKey = typeof FEATURE_KEYS[number];

export function useOrgFeatures() {
  const { organizationId } = useAuth();

  return useQuery({
    queryKey: ["org-features", organizationId],
    queryFn: async () => {
      if (!organizationId) return {} as Record<FeatureKey, boolean>;
      const { data, error } = await supabase
        .from("organization_features")
        .select("feature_name, enabled")
        .eq("organization_id", organizationId);
      if (error) throw error;

      const map: Record<string, boolean> = {};
      for (const f of data || []) {
        map[f.feature_name] = f.enabled;
      }
      // Default all features to true if not set
      const result: Record<FeatureKey, boolean> = {} as any;
      for (const key of FEATURE_KEYS) {
        result[key] = map[key] !== undefined ? map[key] : true;
      }
      return result;
    },
    enabled: !!organizationId,
  });
}

export function useIsFeatureEnabled(feature: FeatureKey): boolean {
  const { data } = useOrgFeatures();
  return data?.[feature] ?? true;
}
