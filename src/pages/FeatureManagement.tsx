import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { FEATURE_KEYS, FeatureKey } from "@/hooks/useFeatures";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Package, FileText, ShoppingCart, Truck, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const FEATURE_META: Record<FeatureKey, { label: string; description: string; icon: React.ElementType }> = {
  inventory: { label: "Inventory Management", description: "Track products, SKUs, and stock levels", icon: Package },
  pos: { label: "Sales / POS", description: "Point-of-sale cart and checkout", icon: ShoppingCart },
  purchases: { label: "Purchase Orders", description: "Receive stock and manage vendors", icon: Truck },
  accounting: { label: "Accounting / Ledger", description: "Double-entry ledger and journal entries", icon: FileText },
  reports: { label: "Financial Reports", description: "Trial balance and financial summaries", icon: BarChart3 },
};

export default function FeatureManagement() {
  const { organizationId, isSuperAdmin, isGroupAdmin } = useAuth();
  const qc = useQueryClient();
  const canManage = isSuperAdmin || isGroupAdmin;

  // Super admins pick any org; group admins manage their own
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const activeOrgId = isSuperAdmin ? selectedOrgId : organizationId;

  // Fetch all organizations for super admin selector
  const { data: allOrgs, isLoading: orgsLoading } = useQuery({
    queryKey: ["all-organizations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  // Fetch features for the selected org
  const { data: orgFeatures, isLoading: featuresLoading } = useQuery({
    queryKey: ["org-features-admin", activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return null;
      const { data, error } = await supabase
        .from("organization_features")
        .select("feature_name, enabled")
        .eq("organization_id", activeOrgId);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      (data || []).forEach((f: any) => { map[f.feature_name] = f.enabled; });
      return map;
    },
    enabled: !!activeOrgId,
  });

  const toggleFeature = async (feature: FeatureKey, enabled: boolean) => {
    if (!activeOrgId) return;
    const { error } = await supabase
      .from("organization_features")
      .upsert(
        { organization_id: activeOrgId, feature_name: feature, enabled },
        { onConflict: "organization_id,feature_name" }
      );
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${FEATURE_META[feature].label} ${enabled ? "enabled" : "disabled"}`);
      qc.invalidateQueries({ queryKey: ["org-features-admin", activeOrgId] });
      // Also refresh sidebar features if editing own org
      if (activeOrgId === organizationId) {
        qc.invalidateQueries({ queryKey: ["org-features"] });
      }
    }
  };

  const isLoading = orgsLoading || featuresLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-muted-foreground" />
        <div>
          <h2 className="text-2xl font-bold">Feature Management</h2>
          <p className="text-sm text-muted-foreground">
            {isSuperAdmin
              ? "Select an organization and toggle its modules"
              : "Enable or disable modules for your organization"}
          </p>
        </div>
      </div>

      {/* Organization selector for super admins */}
      {isSuperAdmin && (
        <Card>
          <CardContent className="p-5">
            <Label className="mb-2 block text-sm font-medium">Select Organization</Label>
            <Select
              value={selectedOrgId || ""}
              onValueChange={(v) => setSelectedOrgId(v)}
            >
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Choose an organization…" />
              </SelectTrigger>
              <SelectContent>
                {allOrgs?.map((org: any) => (
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Feature toggles */}
      {!activeOrgId ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Settings className="mb-2 h-10 w-10" />
          <p>{isSuperAdmin ? "Select an organization above to manage its features" : "No organization assigned"}</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid gap-4">
          {FEATURE_KEYS.map((key) => {
            const meta = FEATURE_META[key];
            const Icon = meta.icon;
            const enabled = orgFeatures?.[key] ?? true;

            return (
              <Card key={key}>
                <CardContent className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-muted p-2.5">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <Label className="text-base font-medium">{meta.label}</Label>
                      <p className="text-sm text-muted-foreground">{meta.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(v) => toggleFeature(key, v)}
                    disabled={!canManage}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
