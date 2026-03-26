import { useState } from "react";
import { useProducts, useReceivePurchase } from "@/hooks/useInventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { Database } from "@/integrations/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

interface PurchaseItem {
  product: Product;
  quantity: number;
  cost: number;
}

export default function Purchases() {
  const { data: products, isLoading } = useProducts();
  const receivePurchase = useReceivePurchase();
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");

  const addItem = () => {
    const product = products?.find((p) => p.id === selectedId);
    if (!product) return;
    setItems([...items, { product, quantity: parseInt(qty) || 1, cost: parseFloat(cost) || product.unit_cost }]);
    setSelectedId("");
    setQty("1");
    setCost("");
  };

  const total = items.reduce((s, i) => s + i.quantity * i.cost, 0);

  const receive = async () => {
    try {
      await receivePurchase.mutateAsync(items);
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
                <Select value={selectedId} onValueChange={(v) => {
                  setSelectedId(v);
                  const p = products?.find((p) => p.id === v);
                  if (p) setCost(String(p.unit_cost));
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
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
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.product.name}</TableCell>
                      <TableCell className="text-right">{fmt(item.cost)}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{fmt(item.quantity * item.cost)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
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
    </div>
  );
}
