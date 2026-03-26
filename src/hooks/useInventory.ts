import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];
type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];

export function useProducts(search?: string) {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ["products", search, organizationId],
    queryFn: async () => {
      let query = supabase.from("products").select("*").order("name");
      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }
      if (search) {
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!organizationId,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ["products", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Product;
    },
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  const { organizationId } = useAuth();
  return useMutation({
    mutationFn: async (product: Omit<ProductInsert, "organization_id">) => {
      const { data, error } = await supabase
        .from("products")
        .insert({ ...product, organization_id: organizationId } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Product> & { id: string }) => {
      const { data, error } = await supabase.from("products").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDashboardStats() {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ["dashboard-stats", organizationId],
    queryFn: async () => {
      let productsQuery = supabase.from("products").select("current_stock, unit_cost, selling_price");
      let salesQuery = supabase.from("transactions").select("total_amount, created_at").eq("type", "Sale");
      let lowStockQuery = supabase.from("products").select("id, name, current_stock, reorder_point");

      if (organizationId) {
        productsQuery = productsQuery.eq("organization_id", organizationId);
        salesQuery = salesQuery.eq("organization_id", organizationId);
        lowStockQuery = lowStockQuery.eq("organization_id", organizationId);
      }

      const [productsRes, salesRes, lowStockRes] = await Promise.all([
        productsQuery,
        salesQuery,
        lowStockQuery,
      ]);

      if (productsRes.error) throw productsRes.error;
      if (salesRes.error) throw salesRes.error;
      if (lowStockRes.error) throw lowStockRes.error;

      const totalStockValue = (productsRes.data || []).reduce(
        (sum, p) => sum + p.current_stock * p.unit_cost, 0
      );

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyRevenue = (salesRes.data || [])
        .filter((s) => new Date(s.created_at) >= monthStart)
        .reduce((sum, s) => sum + Number(s.total_amount), 0);

      const lowStockItems = (lowStockRes.data || []).filter(
        (p) => p.current_stock <= p.reorder_point
      );

      const salesTrend: { date: string; amount: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const dayTotal = (salesRes.data || [])
          .filter((s) => s.created_at.startsWith(dateStr))
          .reduce((sum, s) => sum + Number(s.total_amount), 0);
        salesTrend.push({ date: dateStr, amount: dayTotal });
      }

      return { totalStockValue, monthlyRevenue, lowStockItems, salesTrend };
    },
    enabled: !!organizationId,
  });
}

export function useProcessSale() {
  const qc = useQueryClient();
  const { organizationId } = useAuth();
  return useMutation({
    mutationFn: async (items: { product: Product; quantity: number }[]) => {
      const totalAmount = items.reduce(
        (sum, i) => sum + i.quantity * i.product.selling_price, 0
      );
      const totalCOGS = items.reduce(
        (sum, i) => sum + i.quantity * i.product.unit_cost, 0
      );

      const { data: txn, error: txnErr } = await supabase
        .from("transactions")
        .insert({ type: "Sale", total_amount: totalAmount, status: "Completed", organization_id: organizationId } as any)
        .select()
        .single();
      if (txnErr) throw txnErr;

      for (const item of items) {
        const { error: stockErr } = await supabase
          .from("products")
          .update({ current_stock: item.product.current_stock - item.quantity })
          .eq("id", item.product.id);
        if (stockErr) throw stockErr;

        const { error: logErr } = await supabase.from("inventory_logs").insert({
          product_id: item.product.id,
          change_amount: -item.quantity,
          reason: "Sale",
          reference_transaction_id: txn.id,
          organization_id: organizationId,
        } as any);
        if (logErr) throw logErr;
      }

      await supabase.from("ledger_entries").insert({
        transaction_id: txn.id, account_name: "Cash", debit: totalAmount, credit: 0, organization_id: organizationId,
      } as any);
      await supabase.from("ledger_entries").insert({
        transaction_id: txn.id, account_name: "Revenue", debit: 0, credit: totalAmount, organization_id: organizationId,
      } as any);
      await supabase.from("ledger_entries").insert({
        transaction_id: txn.id, account_name: "COGS", debit: totalCOGS, credit: 0, organization_id: organizationId,
      } as any);
      await supabase.from("ledger_entries").insert({
        transaction_id: txn.id, account_name: "Inventory", debit: 0, credit: totalCOGS, organization_id: organizationId,
      } as any);

      return txn;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["trial-balance"] });
    },
  });
}

export function useReceivePurchase() {
  const qc = useQueryClient();
  const { organizationId } = useAuth();
  return useMutation({
    mutationFn: async (items: { product: Product; quantity: number; cost: number }[]) => {
      const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.cost, 0);

      const { data: txn, error: txnErr } = await supabase
        .from("transactions")
        .insert({ type: "Purchase", total_amount: totalAmount, status: "Completed", organization_id: organizationId } as any)
        .select()
        .single();
      if (txnErr) throw txnErr;

      for (const item of items) {
        const { error: stockErr } = await supabase
          .from("products")
          .update({ current_stock: item.product.current_stock + item.quantity })
          .eq("id", item.product.id);
        if (stockErr) throw stockErr;

        const { error: logErr } = await supabase.from("inventory_logs").insert({
          product_id: item.product.id,
          change_amount: item.quantity,
          reason: "Purchase",
          reference_transaction_id: txn.id,
          organization_id: organizationId,
        } as any);
        if (logErr) throw logErr;
      }

      await supabase.from("ledger_entries").insert({
        transaction_id: txn.id, account_name: "Inventory", debit: totalAmount, credit: 0, organization_id: organizationId,
      } as any);
      await supabase.from("ledger_entries").insert({
        transaction_id: txn.id, account_name: "Cash", debit: 0, credit: totalAmount, organization_id: organizationId,
      } as any);

      return txn;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["trial-balance"] });
    },
  });
}

export function useTrialBalance() {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ["trial-balance", organizationId],
    queryFn: async () => {
      let query = supabase.from("ledger_entries").select("account_name, debit, credit");
      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }
      const { data, error } = await query;
      if (error) throw error;

      const accounts: Record<string, { debit: number; credit: number }> = {};
      for (const entry of data || []) {
        if (!accounts[entry.account_name]) {
          accounts[entry.account_name] = { debit: 0, credit: 0 };
        }
        accounts[entry.account_name].debit += Number(entry.debit);
        accounts[entry.account_name].credit += Number(entry.credit);
      }
      return accounts;
    },
    enabled: !!organizationId,
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  const { organizationId } = useAuth();
  return useMutation({
    mutationFn: async ({ product, newStock, reason }: { product: Product; newStock: number; reason: string }) => {
      const change = newStock - product.current_stock;

      const { data: txn, error: txnErr } = await supabase
        .from("transactions")
        .insert({ type: "Adjustment", total_amount: 0, status: "Completed", notes: reason, organization_id: organizationId } as any)
        .select()
        .single();
      if (txnErr) throw txnErr;

      const { error: stockErr } = await supabase
        .from("products")
        .update({ current_stock: newStock })
        .eq("id", product.id);
      if (stockErr) throw stockErr;

      const { error: logErr } = await supabase.from("inventory_logs").insert({
        product_id: product.id,
        change_amount: change,
        reason: `Adjustment: ${reason}`,
        reference_transaction_id: txn.id,
        organization_id: organizationId,
      } as any);
      if (logErr) throw logErr;

      if (change > 0) {
        await supabase.from("ledger_entries").insert({
          transaction_id: txn.id, account_name: "Inventory", debit: Math.abs(change) * product.unit_cost, credit: 0, organization_id: organizationId,
        } as any);
      } else if (change < 0) {
        await supabase.from("ledger_entries").insert({
          transaction_id: txn.id, account_name: "Inventory", debit: 0, credit: Math.abs(change) * product.unit_cost, organization_id: organizationId,
        } as any);
      }

      return txn;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["trial-balance"] });
    },
  });
}
