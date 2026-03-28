import { useState } from "react";
import { useProducts, useProductVariants, useReceivePurchase, type ProductRow, type ProductVariant } from "@/hooks/useInventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Truck, Trash2 } from "lucide-react";
import { toast } from "sonner";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

interface PurchaseItem {
  variant: ProductVariant;
  productName: string;
  quantity: number;
  cost: number;
}

function VariantPicker({
  product,
  open,
  onOpenChange,
  onSelect,
}: {
  product: ProductRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelect: (v: ProductVariant) => void;
}) {
  const { data: variants, isLoading } = useProductVariants(product?.id || "");
  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Variant — {product.name}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="grid gap-2 py-2 max-h-72 overflow-y-auto">
            {(variants || []).map((v) => {
              const label = v.attribute_values?.map((av) => av.option_value).join(" / ") || v.sku;
              return (
                <button
                  key={v.id}
                  onClick={() => { onSelect(v); onOpenChange(false); }}
                  className="flex items-center justify-between rounded-lg border p-3 text-left hover:bg-accent active:scale-[0.98]"
                >
                  <div>
                    {v.attribute_values && v.attribute_values.length > 0 ? (
                      <div className="flex gap-1 mb-1">
                        {v.attribute_values.map((av, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{av.option_value}</Badge>
                        ))}
                      </div>
                    ) : null}
                    <p className="text-xs text-muted-foreground">{v.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{fmt(v.unit_cost)}</p>
                    <p className="text-xs text-muted-foreground">{v.stock_quantity} in stock</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Purchases() {
  const { data: products, isLoading } = useProducts();
  const receivePurchase = useReceivePurchase();
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");
  const [pickerProduct, setPickerProduct] = useState<ProductRow | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleProductSelect = (productId: string) => {
    setSelectedId(productId);
    const product = products?.find((p) => p.id === productId);
    if (!product) return;

    if (product.has_variants) {
      setPickerProduct(product);
      setPickerOpen(true);
    }
    setCost(String(product.unit_cost));
  };

  const handleVariantPicked = (variant: ProductVariant) => {
    const product = products?.find((p) => p.id === variant.product_id);
    setCost(String(variant.unit_cost));
    addItemDirect(variant, product?.name || "Product", parseInt(qty) || 1, variant.unit_cost);
    setSelectedId("");
    setQty("1");
    setCost("");
  };

  const addItemDirect = (variant: ProductVariant, productName: string, quantity: number, unitCost: number) => {
    setItems([...items, { variant, productName, quantity, cost: unitCost }]);
  };

  const addItem = () => {
    const product = products?.find((p) => p.id === selectedId);
    if (!product) return;

    if (product.has_variants) {
      setPickerProduct(product);
      setPickerOpen(true);
      return;
    }

    // Non-variant: fetch default variant inline (we'll create a temp one from product data)
    // Actually we need the variant. Let's open the picker for all products.
    setPickerProduct(product);
    setPickerOpen(true);
  };

  const total = items.reduce((s, i) => s + i.quantity * i.cost, 0);

  const receive = async () => {
    try {
      await receivePurchase.mutateAsync(items.map((i) => ({ variant: i.variant, quantity: i.quantity, cost: i.cost })));
      toast.success("Purchase received!");
      setItems([]);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Purchase Orders</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Item to Order</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label>Product</Label>
                <Select value={selectedId} onValueChange={handleProductSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.has_variants ? "(Variants)" : `(${p.sku})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <Label>Qty</Label>
                <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div className="w-28">
                <Label>Unit Cost</Label>
                <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
              </div>
              <Button onClick={addItem} disabled={!selectedId}>Add</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4" /> Order Items
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Truck className="mb-2 h-8 w-8" />
              <p>No items added</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product / Variant</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => {
                    const attrLabel = item.variant.attribute_values?.map((av) => av.option_value).join(" / ");
                    return (
                      <TableRow key={idx}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.productName}</p>
                            {attrLabel && <p className="text-xs text-muted-foreground">{attrLabel}</p>}
                            <p className="text-xs text-muted-foreground">{item.variant.sku}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{fmt(item.cost)}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{fmt(item.quantity * item.cost)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t p-4">
                <span className="text-lg font-bold">Total: {fmt(total)}</span>
                <Button onClick={receive} disabled={receivePurchase.isPending} size="lg">
                  {receivePurchase.isPending ? "Receiving..." : "Receive Stock"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <VariantPicker
        product={pickerProduct}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleVariantPicked}
      />
    </div>
  );
}
