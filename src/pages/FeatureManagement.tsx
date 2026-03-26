import { useAuth } from "@/hooks/useAuth";
import { useOrgFeatures, FEATURE_KEYS, FeatureKey } from "@/hooks/useFeatures";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Package, FileText, ShoppingCart, Truck, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const FEATURE_META: Record<FeatureKey, { label: string; description: string; icon: React.ElementType }> = {
  inventory: { label: "Inventory Management", description: "Track products, SKUs, and stock levels", icon: Package },
  pos: { label: "Sales / POS", description: "Point-of-sale cart and checkout", icon: ShoppingCart },
  purchases: { label: "Purchase Orders", description: "Receive stock and manage vendors", icon: Truck },
  accounting: { label: "Accounting / Ledger", description: "Double-entry ledger and journal entries", icon: FileText },
  reports: { label: "Financial Reports", description: "Trial balance and financial summaries", icon: BarChart3 },
};

export default function FeatureManagement() {
  const { organizationId, isSuperAdmin, isGroupAdmin } = useAuth();
  const { data: features, isLoading } = useOrgFeatures();
  const qc = useQueryClient();

  const canManage = isSuperAdmin || isGroupAdmin;

  const toggleFeature = async (feature: FeatureKey, enabled: boolean) => {
    if (!organizationId) return;
    const { error } = await supabase
      .from("organization_features")
      .upsert(
        { organization_id: organizationId, feature_name: feature, enabled },
        { onConflict: "organization_id,feature_name" }
      );
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${FEATURE_META[feature].label} ${enabled ? "enabled" : "disabled"}`);
      qc.invalidateQueries({ queryKey: ["org-features"] });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Feature Management</h2>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-muted-foreground" />
        <div>
          <h2 className="text-2xl font-bold">Feature Management</h2>
          <p className="text-sm text-muted-foreground">Enable or disable modules for your organization</p>
        </div>
      </div>

      <div className="grid gap-4">
        {FEATURE_KEYS.map((key) => {
          const meta = FEATURE_META[key];
          const Icon = meta.icon;
          const enabled = features?.[key] ?? true;

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
    </div>
  );
}
