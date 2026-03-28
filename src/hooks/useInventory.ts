import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// ── Local types for new tables (auto-generated types may lag) ──────────
export interface Attribute {
  id: string;
  name: string;
  organization_id: string | null;
  created_at: string;
}

export interface AttributeOption {
  id: string;
  attribute_id: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  price_override: number | null;
  unit_cost: number;
  stock_quantity: number;
  reorder_point: number;
  barcode: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
  // joined fields
  product?: ProductRow;
  attribute_values?: { attribute_name: string; option_value: string }[];
}

export interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  base_price: number;
  image_url: string | null;
  has_variants: boolean;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
  // legacy columns still on table
  sku: string;
  unit_cost: number;
  selling_price: number;
  current_stock: number;
  reorder_point: number;
}

// ── Products ───────────────────────────────────────────────────────────
export function useProducts(search?: string) {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ["products", search, organizationId],
    queryFn: async () => {
      let query = supabase.from("products").select("*").order("name");
      if (organizationId) query = query.eq("organization_id", organizationId);
      if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as ProductRow[];
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
      return data as unknown as ProductRow;
    },
    enabled: !!id,
  });
}

// ── Variants ───────────────────────────────────────────────────────────
export function useProductVariants(productId: string) {
  return useQuery({
    queryKey: ["product-variants", productId],
    queryFn: async () => {
      const { data: variants, error } = await (supabase as any)
        .from("product_variants")
        .select("*")
        .eq("product_id", productId)
        .order("sku");
      if (error) throw error;

      // Fetch attribute values for each variant
      const variantIds = (variants as ProductVariant[]).map((v) => v.id);
      if (variantIds.length === 0) return variants as ProductVariant[];

      const { data: vavs, error: vavErr } = await (supabase as any)
        .from("variant_attribute_values")
        .select("variant_id, attribute_option_id")
        .in("variant_id", variantIds);
      if (vavErr) throw vavErr;

      const optionIds = [...new Set((vavs || []).map((v: any) => v.attribute_option_id))];
      let optionsMap: Record<string, { value: string; attribute_id: string }> = {};
      let attrsMap: Record<string, string> = {};

      if (optionIds.length > 0) {
        const { data: opts } = await (supabase as any)
          .from("attribute_options")
          .select("id, value, attribute_id")
          .in("id", optionIds);
        for (const o of opts || []) optionsMap[o.id] = { value: o.value, attribute_id: o.attribute_id };

        const attrIds = [...new Set(Object.values(optionsMap).map((o) => o.attribute_id))];
        const { data: attrs } = await (supabase as any)
          .from("attributes")
          .select("id, name")
          .in("id", attrIds);
        for (const a of attrs || []) attrsMap[a.id] = a.name;
      }

      return (variants as ProductVariant[]).map((v) => ({
        ...v,
        attribute_values: (vavs || [])
          .filter((vav: any) => vav.variant_id === v.id)
          .map((vav: any) => {
            const opt = optionsMap[vav.attribute_option_id];
            return {
              attribute_name: opt ? attrsMap[opt.attribute_id] || "" : "",
              option_value: opt?.value || "",
            };
          }),
      }));
    },
    enabled: !!productId,
  });
}

export function useAllVariants(search?: string) {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ["all-variants", search, organizationId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("product_variants")
        .select("*, products!inner(name, category, base_price, has_variants, image_url)")
        .order("sku");
      if (organizationId) query = query.eq("organization_id", organizationId);
      if (search) query = query.or(`sku.ilike.%${search}%,products.name.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((v: any) => ({
        ...v,
        product: v.products,
      })) as ProductVariant[];
    },
    enabled: !!organizationId,
  });
}

// ── Attributes ─────────────────────────────────────────────────────────
export function useAttributes() {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ["attributes", organizationId],
    queryFn: async () => {
      let query = (supabase as any).from("attributes").select("*, attribute_options(*)").order("name");
      if (organizationId) query = query.eq("organization_id", organizationId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as (Attribute & { attribute_options: AttributeOption[] })[];
    },
    enabled: !!organizationId,
  });
}

// ── Create Product (with optional variants) ────────────────────────────
interface CreateProductInput {
  name: string;
  description?: string;
  category: string;
  base_price: number;
  image_url?: string;
  has_variants: boolean;
  // For non-variant products
  sku?: string;
  unit_cost?: number;
  stock_quantity?: number;
  reorder_point?: number;
  // For variant products
  attributes?: { name: string; values: string[] }[];
  variants?: {
    sku: string;
    price_override?: number;
    unit_cost: number;
    stock_quantity: number;
    reorder_point: number;
    optionIndices: number[]; // index into the cartesian product
    optionValues: { attributeName: string; optionValue: string }[];
  }[];
}

export function useCreateProduct() {
  const qc = useQueryClient();
  const { organizationId } = useAuth();
  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      // 1. Create product
      const { data: product, error: prodErr } = await supabase
        .from("products")
        .insert({
          name: input.name,
          category: input.category,
          organization_id: organizationId,
          sku: input.has_variants ? `${input.name.substring(0, 3).toUpperCase()}-BASE` : (input.sku || ""),
          unit_cost: input.unit_cost || 0,
          selling_price: input.base_price,
          current_stock: input.stock_quantity || 0,
          reorder_point: input.reorder_point || 10,
        } as any)
        .select()
        .single();
      if (prodErr) throw prodErr;

      // Update with new columns
      await (supabase as any)
        .from("products")
        .update({
          description: input.description || null,
          base_price: input.base_price,
          image_url: input.image_url || null,
          has_variants: input.has_variants,
        })
        .eq("id", product.id);

      if (!input.has_variants) {
        // Create a single default variant
        await (supabase as any).from("product_variants").insert({
          product_id: product.id,
          sku: input.sku || product.sku,
          unit_cost: input.unit_cost || 0,
          stock_quantity: input.stock_quantity || 0,
          reorder_point: input.reorder_point || 10,
          price_override: input.base_price,
          organization_id: organizationId,
        });
      } else if (input.attributes && input.variants) {
        // 2. Create or get attributes + options
        const attrOptionMap: Record<string, Record<string, string>> = {}; // attrName -> optionValue -> optionId

        for (const attr of input.attributes) {
          // Upsert attribute
          let { data: existingAttr } = await (supabase as any)
            .from("attributes")
            .select("id")
            .eq("name", attr.name)
            .eq("organization_id", organizationId)
            .maybeSingle();

          let attrId: string;
          if (existingAttr) {
            attrId = existingAttr.id;
          } else {
            const { data: newAttr, error: attrErr } = await (supabase as any)
              .from("attributes")
              .insert({ name: attr.name, organization_id: organizationId })
              .select()
              .single();
            if (attrErr) throw attrErr;
            attrId = newAttr.id;
          }

          attrOptionMap[attr.name] = {};
          for (const val of attr.values) {
            let { data: existingOpt } = await (supabase as any)
              .from("attribute_options")
              .select("id")
              .eq("attribute_id", attrId)
              .eq("value", val)
              .maybeSingle();

            if (existingOpt) {
              attrOptionMap[attr.name][val] = existingOpt.id;
            } else {
              const { data: newOpt, error: optErr } = await (supabase as any)
                .from("attribute_options")
                .insert({ attribute_id: attrId, value: val })
                .select()
                .single();
              if (optErr) throw optErr;
              attrOptionMap[attr.name][val] = newOpt.id;
            }
          }
        }

        // 3. Create variants with junction records
        for (const variant of input.variants) {
          const { data: pv, error: pvErr } = await (supabase as any)
            .from("product_variants")
            .insert({
              product_id: product.id,
              sku: variant.sku,
              price_override: variant.price_override ?? null,
              unit_cost: variant.unit_cost,
              stock_quantity: variant.stock_quantity,
              reorder_point: variant.reorder_point,
              organization_id: organizationId,
            })
            .select()
            .single();
          if (pvErr) throw pvErr;

          // Link to attribute options
          for (const ov of variant.optionValues) {
            const optionId = attrOptionMap[ov.attributeName]?.[ov.optionValue];
            if (optionId) {
              await (supabase as any).from("variant_attribute_values").insert({
                variant_id: pv.id,
                attribute_option_id: optionId,
              });
            }
          }
        }
      }

      return product;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["all-variants"] });
      qc.invalidateQueries({ queryKey: ["attributes"] });
    },
  });
}

// ── Update Variant Stock ───────────────────────────────────────────────
export function useUpdateVariantStock() {
  const qc = useQueryClient();
  const { organizationId } = useAuth();
  return useMutation({
    mutationFn: async ({ variantId, newStock, reason }: { variantId: string; newStock: number; reason: string }) => {
      // Get current variant
      const { data: variant, error: vErr } = await (supabase as any)
        .from("product_variants")
        .select("*")
        .eq("id", variantId)
        .single();
      if (vErr) throw vErr;

      const change = newStock - variant.stock_quantity;

      const { data: txn, error: txnErr } = await supabase
        .from("transactions")
        .insert({ type: "Adjustment", total_amount: 0, status: "Completed", notes: reason, organization_id: organizationId } as any)
        .select()
        .single();
      if (txnErr) throw txnErr;

      await (supabase as any)
        .from("product_variants")
        .update({ stock_quantity: newStock })
        .eq("id", variantId);

      await supabase.from("inventory_logs").insert({
        product_id: variant.product_id,
        change_amount: change,
        reason: `Adjustment: ${reason}`,
        reference_transaction_id: txn.id,
        organization_id: organizationId,
      } as any);

      if (change !== 0) {
        const costImpact = Math.abs(change) * variant.unit_cost;
        await supabase.from("ledger_entries").insert({
          transaction_id: txn.id,
          account_name: "Inventory",
          debit: change > 0 ? costImpact : 0,
          credit: change < 0 ? costImpact : 0,
          organization_id: organizationId,
        } as any);
      }

      return txn;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product-variants"] });
      qc.invalidateQueries({ queryKey: ["all-variants"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["trial-balance"] });
    },
  });
}

// ── Process Sale (variant-based) ───────────────────────────────────────
export function useProcessSale() {
  const qc = useQueryClient();
  const { organizationId } = useAuth();
  return useMutation({
    mutationFn: async (items: { variant: ProductVariant; quantity: number }[]) => {
      const totalAmount = items.reduce(
        (sum, i) => sum + i.quantity * (i.variant.price_override ?? i.variant.unit_cost),
        0
      );
      const totalCOGS = items.reduce(
        (sum, i) => sum + i.quantity * i.variant.unit_cost,
        0
      );

      const { data: txn, error: txnErr } = await supabase
        .from("transactions")
        .insert({ type: "Sale", total_amount: totalAmount, status: "Completed", organization_id: organizationId } as any)
        .select()
        .single();
      if (txnErr) throw txnErr;

      for (const item of items) {
        await (supabase as any)
          .from("product_variants")
          .update({ stock_quantity: item.variant.stock_quantity - item.quantity })
          .eq("id", item.variant.id);

        await supabase.from("inventory_logs").insert({
          product_id: item.variant.product_id,
          change_amount: -item.quantity,
          reason: "Sale",
          reference_transaction_id: txn.id,
          organization_id: organizationId,
        } as any);
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
      qc.invalidateQueries({ queryKey: ["product-variants"] });
      qc.invalidateQueries({ queryKey: ["all-variants"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["trial-balance"] });
    },
  });
}

// ── Receive Purchase (variant-based) ───────────────────────────────────
export function useReceivePurchase() {
  const qc = useQueryClient();
  const { organizationId } = useAuth();
  return useMutation({
    mutationFn: async (items: { variant: ProductVariant; quantity: number; cost: number }[]) => {
      const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.cost, 0);

      const { data: txn, error: txnErr } = await supabase
        .from("transactions")
        .insert({ type: "Purchase", total_amount: totalAmount, status: "Completed", organization_id: organizationId } as any)
        .select()
        .single();
      if (txnErr) throw txnErr;

      for (const item of items) {
        await (supabase as any)
          .from("product_variants")
          .update({ stock_quantity: item.variant.stock_quantity + item.quantity })
          .eq("id", item.variant.id);

        await supabase.from("inventory_logs").insert({
          product_id: item.variant.product_id,
          change_amount: item.quantity,
          reason: "Purchase",
          reference_transaction_id: txn.id,
          organization_id: organizationId,
        } as any);
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
      qc.invalidateQueries({ queryKey: ["product-variants"] });
      qc.invalidateQueries({ queryKey: ["all-variants"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["trial-balance"] });
    },
  });
}

// ── Dashboard Stats (variant-based) ────────────────────────────────────
export function useDashboardStats() {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ["dashboard-stats", organizationId],
    queryFn: async () => {
      let variantsQuery = (supabase as any).from("product_variants").select("stock_quantity, unit_cost, reorder_point, product_id, sku");
      let salesQuery = supabase.from("transactions").select("total_amount, created_at").eq("type", "Sale");
      let productsQuery = supabase.from("products").select("id, name");

      if (organizationId) {
        variantsQuery = variantsQuery.eq("organization_id", organizationId);
        salesQuery = salesQuery.eq("organization_id", organizationId);
        productsQuery = productsQuery.eq("organization_id", organizationId);
      }

      const [variantsRes, salesRes, productsRes] = await Promise.all([variantsQuery, salesQuery, productsQuery]);
      if (variantsRes.error) throw variantsRes.error;
      if (salesRes.error) throw salesRes.error;
      if (productsRes.error) throw productsRes.error;

      const productNameMap: Record<string, string> = {};
      for (const p of productsRes.data || []) productNameMap[p.id] = p.name;

      const totalStockValue = (variantsRes.data || []).reduce(
        (sum: number, v: any) => sum + v.stock_quantity * v.unit_cost, 0
      );

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyRevenue = (salesRes.data || [])
        .filter((s: any) => new Date(s.created_at) >= monthStart)
        .reduce((sum: number, s: any) => sum + Number(s.total_amount), 0);

      const lowStockItems = (variantsRes.data || [])
        .filter((v: any) => v.stock_quantity <= v.reorder_point)
        .map((v: any) => ({
          id: v.product_id,
          name: `${productNameMap[v.product_id] || "Unknown"} (${v.sku})`,
          current_stock: v.stock_quantity,
          reorder_point: v.reorder_point,
        }));

      const salesTrend: { date: string; amount: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const dayTotal = (salesRes.data || [])
          .filter((s: any) => s.created_at.startsWith(dateStr))
          .reduce((sum: number, s: any) => sum + Number(s.total_amount), 0);
        salesTrend.push({ date: dateStr, amount: dayTotal });
      }

      return { totalStockValue, monthlyRevenue, lowStockItems, salesTrend };
    },
    enabled: !!organizationId,
  });
}

// ── Trial Balance (unchanged) ──────────────────────────────────────────
export function useTrialBalance() {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ["trial-balance", organizationId],
    queryFn: async () => {
      let query = supabase.from("ledger_entries").select("account_name, debit, credit");
      if (organizationId) query = query.eq("organization_id", organizationId);
      const { data, error } = await query;
      if (error) throw error;

      const accounts: Record<string, { debit: number; credit: number }> = {};
      for (const entry of data || []) {
        if (!accounts[entry.account_name]) accounts[entry.account_name] = { debit: 0, credit: 0 };
        accounts[entry.account_name].debit += Number(entry.debit);
        accounts[entry.account_name].credit += Number(entry.credit);
      }
      return accounts;
    },
    enabled: !!organizationId,
  });
}

// ── Legacy compat exports ──────────────────────────────────────────────
export function useAdjustStock() {
  return useUpdateVariantStock();
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { data, error } = await supabase.from("products").update(updates as any).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}
