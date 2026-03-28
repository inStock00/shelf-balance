import { useState } from "react";
import { useProducts, useAllVariants, useProductVariants, useUpdateVariantStock, type ProductRow, type ProductVariant } from "@/hooks/useInventory";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, SlidersHorizontal, ChevronDown, ChevronRight, Package } from "lucide-react";
import { toast } from "sonner";
import AddProductDialog from "@/components/inventory/AddProductDialog";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function VariantRows({ product }: { product: ProductRow }) {
  const { data: variants, isLoading } = useProductVariants(product.id);

  if (isLoading) return (
    <TableRow>
      <TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell>
    </TableRow>
  );

  return (
    <>
      {(variants || []).map((v) => (
        <VariantRow key={v.id} variant={v} productName={product.name} />
      ))}
    </>
  );
}

function VariantRow({ variant, productName }: { variant: ProductVariant; productName: string }) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [newStock, setNewStock] = useState(String(variant.stock_quantity));
  const [reason, setReason] = useState("");
  const updateStock = useUpdateVariantStock();

  const handleAdjust = async () => {
    try {
      await updateStock.mutateAsync({
        variantId: variant.id,
        newStock: parseInt(newStock),
        reason: reason || "Manual adjustment",
      });
      toast.success("Stock adjusted");
      setAdjustOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const attrLabel = variant.attribute_values?.map((av) => av.option_value).join(" / ") || "";
  const price = variant.price_override ?? variant.unit_cost;

  return (
    <>
      <TableRow className="bg-muted/20">
        <TableCell className="pl-10 text-muted-foreground text-sm">
          {attrLabel ? (
            <div className="flex gap-1">
              {variant.attribute_values?.map((av, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {av.attribute_name}: {av.option_value}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="italic">Default</span>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">{variant.sku}</TableCell>
        <TableCell></TableCell>
        <TableCell className="text-right text-sm">{fmt(variant.unit_cost)}</TableCell>
        <TableCell className="text-right text-sm">{fmt(price)}</TableCell>
        <TableCell className="text-right">
          <span className={variant.stock_quantity <= variant.reorder_point ? "text-destructive font-semibold" : ""}>
            {variant.stock_quantity}
          </span>
        </TableCell>
        <TableCell className="text-right text-sm">{fmt(variant.stock_quantity * variant.unit_cost)}</TableCell>
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setNewStock(String(variant.stock_quantity));
              setReason("");
              setAdjustOpen(true);
            }}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Adjust — {productName} ({variant.sku})</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Current Stock: {variant.stock_quantity}</Label>
              <Input type="number" value={newStock} onChange={(e) => setNewStock(e.target.value)} placeholder="New stock count" className="mt-1" />
            </div>
            <div>
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g., Physical count correction" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
            <Button onClick={handleAdjust} disabled={updateStock.isPending}>Adjust</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: products, isLoading } = useProducts(search);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold">Inventory</h2>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !products?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="mb-2 h-10 w-10" />
              <p>No products found</p>
              <p className="text-sm">Add your first product to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <>
                      <TableRow
                        key={p.id}
                        className={p.has_variants ? "cursor-pointer" : ""}
                        onClick={() => p.has_variants && toggleExpand(p.id)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {p.has_variants && (
                              expanded.has(p.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                            )}
                            {p.name}
                            {p.has_variants && (
                              <Badge variant="secondary" className="text-xs">Variants</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.has_variants ? "—" : p.sku}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{p.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{p.has_variants ? "—" : fmt(p.unit_cost)}</TableCell>
                        <TableCell className="text-right">{fmt(p.base_price || p.selling_price)}</TableCell>
                        <TableCell className="text-right">
                          {p.has_variants ? "—" : (
                            <span className={p.current_stock <= p.reorder_point ? "text-destructive font-semibold" : ""}>
                              {p.current_stock}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{p.has_variants ? "—" : fmt(p.current_stock * p.unit_cost)}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      {p.has_variants && expanded.has(p.id) && (
                        <VariantRows key={`v-${p.id}`} product={p} />
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddProductDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
