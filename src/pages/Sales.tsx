import { useState } from "react";
import { useProducts, useProcessSale } from "@/hooks/useInventory";
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
import { ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

interface CartItem {
  product: Product;
  quantity: number;
}

export default function Sales() {
  const { data: products, isLoading } = useProducts();
  const processSale = useProcessSale();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [qty, setQty] = useState("1");

  const addToCart = () => {
    const product = products?.find((p) => p.id === selectedId);
    if (!product) return;
    const quantity = parseInt(qty) || 1;
    if (quantity > product.current_stock) {
      toast.error(`Only ${product.current_stock} in stock`);
      return;
    }
    const existing = cart.find((c) => c.product.id === product.id);
    if (existing) {
      setCart(cart.map((c) =>
        c.product.id === product.id ? { ...c, quantity: c.quantity + quantity } : c
      ));
    } else {
      setCart([...cart, { product, quantity }]);
    }
    setSelectedId("");
    setQty("1");
  };

  const removeFromCart = (id: string) => setCart(cart.filter((c) => c.product.id !== id));

  const total = cart.reduce((s, c) => s + c.quantity * c.product.selling_price, 0);

  const checkout = async () => {
    try {
      await processSale.mutateAsync(cart);
      toast.success("Sale completed!");
      setCart([]);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Sales / POS</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Item</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label>Product</Label>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {fmt(p.selling_price)} (Stock: {p.current_stock})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <Label>Qty</Label>
                <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <Button onClick={addToCart} disabled={!selectedId}>Add</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4" /> Cart
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShoppingCart className="mb-2 h-8 w-8" />
              <p>Cart is empty</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.map((c) => (
                    <TableRow key={c.product.id}>
                      <TableCell className="font-medium">{c.product.name}</TableCell>
                      <TableCell className="text-right">{fmt(c.product.selling_price)}</TableCell>
                      <TableCell className="text-right">{c.quantity}</TableCell>
                      <TableCell className="text-right">{fmt(c.quantity * c.product.selling_price)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeFromCart(c.product.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t p-4">
                <span className="text-lg font-bold">Total: {fmt(total)}</span>
                <Button onClick={checkout} disabled={processSale.isPending} size="lg">
                  {processSale.isPending ? "Processing..." : "Checkout"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
