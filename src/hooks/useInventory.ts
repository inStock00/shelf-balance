import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];
type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];

export function useProducts(search?: string) {
  return useQuery({
    queryKey: ["products", search],
    queryFn: async () => {
      let query = supabase.from("products").select("*").order("name");
      if (search) {
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
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
  return useMutation({
    mutationFn: async (product: ProductInsert) => {
      const { data, error } = await supabase.from("products").insert(product).select().single();
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
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [productsRes, salesRes, lowStockRes] = await Promise.all([
        supabase.from("products").select("current_stock, unit_cost, selling_price"),
        supabase.from("transactions").select("total_amount, created_at").eq("type", "Sale"),
        supabase.from("products").select("id, name, current_stock, reorder_point"),
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

      // 7-day sales trend
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
  });
}

export function useProcessSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { product: Product; quantity: number }[]) => {
      const totalAmount = items.reduce(
        (sum, i) => sum + i.quantity * i.product.selling_price, 0
      );
      const totalCOGS = items.reduce(
        (sum, i) => sum + i.quantity * i.product.unit_cost, 0
      );

      // Create transaction
      const { data: txn, error: txnErr } = await supabase
        .from("transactions")
        .insert({ type: "Sale", total_amount: totalAmount, status: "Completed" })
        .select()
        .single();
      if (txnErr) throw txnErr;

      // Update stock & create inventory logs
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
        });
        if (logErr) throw logErr;
      }

      // Double-entry: Debit Cash, Credit Revenue
      const { error: le1 } = await supabase.from("ledger_entries").insert({
        transaction_id: txn.id, account_name: "Cash", debit: totalAmount, credit: 0,
      });
      if (le1) throw le1;

      const { error: le2 } = await supabase.from("ledger_entries").insert({
        transaction_id: txn.id, account_name: "Revenue", debit: 0, credit: totalAmount,
      });
      if (le2) throw le2;

      // Debit COGS, Credit Inventory
      const { error: le3 } = await supabase.from("ledger_entries").insert({
        transaction_id: txn.id, account_name: "COGS", debit: totalCOGS, credit: 0,
      });
      if (le3) throw le3;

      const { error: le4 } = await supabase.from("ledger_entries").insert({
        transaction_id: txn.id, account_name: "Inventory", debit: 0, credit: totalCOGS,
      });
      if (le4) throw le4;

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
  return useMutation({
    mutationFn: async (items: { product: Product; quantity: number; cost: number }[]) => {
      const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.cost, 0);

      const { data: txn, error: txnErr } = await supabase
        .from("transactions")
        .insert({ type: "Purchase", total_amount: totalAmount, status: "Completed" })
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
        });
        if (logErr) throw logErr;
      }

      // Debit Inventory, Credit Cash
      const { error: le1 } = await supabase.from("ledger_entries").insert({
        transaction_id: txn.id, account_name: "Inventory", debit: totalAmount, credit: 0,
      });
      if (le1) throw le1;

      const { error: le2 } = await supabase.from("ledger_entries").insert({
        transaction_id: txn.id, account_name: "Cash", debit: 0, credit: totalAmount,
      });
      if (le2) throw le2;

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
  return useQuery({
    queryKey: ["trial-balance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ledger_entries").select("account_name, debit, credit");
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
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ product, newStock, reason }: { product: Product; newStock: number; reason: string }) => {
      const change = newStock - product.current_stock;

      const { data: txn, error: txnErr } = await supabase
        .from("transactions")
        .insert({ type: "Adjustment", total_amount: 0, status: "Completed", notes: reason })
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
      });
      if (logErr) throw logErr;

      // Adjust inventory ledger
      if (change > 0) {
        await supabase.from("ledger_entries").insert({
          transaction_id: txn.id, account_name: "Inventory", debit: Math.abs(change) * product.unit_cost, credit: 0,
        });
      } else if (change < 0) {
        await supabase.from("ledger_entries").insert({
          transaction_id: txn.id, account_name: "Inventory", debit: 0, credit: Math.abs(change) * product.unit_cost,
        });
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
