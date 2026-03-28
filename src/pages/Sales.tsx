import { useState, useMemo } from "react";
import { useProducts, useProductVariants, useProcessSale, type ProductRow, type ProductVariant } from "@/hooks/useInventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ShoppingCart, Trash2, Search, Package, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

interface CartItem {
  variant: ProductVariant;
  productName: string;
  quantity: number;
  price: number;
}

function VariantSelectorModal({
  product,
  open,
  onOpenChange,
  onSelectVariant,
}: {
  product: ProductRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectVariant: (variant: ProductVariant) => void;
}) {
  const { data: variants, isLoading } = useProductVariants(product?.id || "");

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Variant — {product.name}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2 py-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <div className="grid gap-2 py-4 max-h-80 overflow-y-auto">
            {(variants || []).map((v) => {
              const price = v.price_override ?? v.unit_cost;
              const label = v.attribute_values?.map((av) => av.option_value).join(" / ") || v.sku;
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    onSelectVariant(v);
                    onOpenChange(false);
                  }}
                  disabled={v.stock_quantity <= 0}
                  className="flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  <div>
                    <div className="flex gap-1 mb-1">
                      {v.attribute_values?.map((av, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{av.attribute_name}: {av.option_value}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{v.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{fmt(price)}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.stock_quantity > 0 ? `${v.stock_quantity} in stock` : "Out of stock"}
                    </p>
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

// For simple (non-variant) products, fetch their single variant
function useSimpleVariant(product: ProductRow | null) {
  const { data: variants } = useProductVariants(product?.id || "");
  return variants?.[0] || null;
}

export default function Sales() {
  const { data: products, isLoading } = useProducts();
  const processSale = useProcessSale();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);
  const [variantModalOpen, setVariantModalOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  }, [products, search]);

  const handleProductClick = (product: ProductRow) => {
    if (product.has_variants) {
      setSelectedProduct(product);
      setVariantModalOpen(true);
    } else {
      // For non-variant products, we need to get the default variant
      setSelectedProduct(product);
      setVariantModalOpen(true);
    }
  };

  const addVariantToCart = (variant: ProductVariant, productName?: string) => {
    if (variant.stock_quantity <= 0) {
      toast.error("Out of stock");
      return;
    }

    const name = productName || selectedProduct?.name || "Product";
    const price = variant.price_override ?? variant.unit_cost;
    const existing = cart.find((c) => c.variant.id === variant.id);

    if (existing) {
      if (existing.quantity + 1 > variant.stock_quantity) {
        toast.error(`Only ${variant.stock_quantity} in stock`);
        return;
      }
      setCart(cart.map((c) => (c.variant.id === variant.id ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([...cart, { variant, productName: name, quantity: 1, price }]);
    }
  };

  const updateQty = (variantId: string, delta: number) => {
    setCart(
      cart
        .map((c) => {
          if (c.variant.id !== variantId) return c;
          const newQty = c.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > c.variant.stock_quantity) {
            toast.error(`Only ${c.variant.stock_quantity} in stock`);
            return c;
          }
          return { ...c, quantity: newQty };
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (variantId: string) => setCart(cart.filter((c) => c.variant.id !== variantId));

  const total = cart.reduce((s, c) => s + c.quantity * c.price, 0);

  const checkout = async () => {
    try {
      await processSale.mutateAsync(cart.map((c) => ({ variant: c.variant, quantity: c.quantity })));
      toast.success("Sale completed!");
      setCart([]);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Product Grid */}
      <div className="flex-1 space-y-4">
        <h2 className="text-2xl font-bold">Sales / POS</h2>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Package className="mb-2 h-10 w-10" />
            <p>No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => handleProductClick(p)}
                className="flex flex-col items-start rounded-xl border bg-card p-4 text-left transition-all hover:shadow-md hover:border-primary/50 active:scale-[0.97] touch-manipulation"
              >
                <div className="flex items-center gap-2 mb-2 w-full">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  {p.has_variants && (
                    <Badge variant="secondary" className="text-[10px] ml-auto">Variants</Badge>
                  )}
                </div>
                <p className="font-medium text-sm line-clamp-2">{p.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{p.category}</p>
                <p className="text-sm font-bold mt-auto pt-2">{fmt(p.base_price || p.selling_price)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart */}
      <div className="lg:w-96 lg:min-w-[24rem]">
        <Card className="sticky top-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4" /> Cart
              {cart.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{cart.reduce((s, c) => s + c.quantity, 0)}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ShoppingCart className="mb-2 h-8 w-8" />
                <p className="text-sm">Tap a product to add it</p>
              </div>
            ) : (
              <>
                <div className="max-h-[50vh] overflow-y-auto divide-y">
                  {cart.map((c) => {
                    const attrLabel = c.variant.attribute_values
                      ?.map((av) => av.option_value)
                      .join(" / ");
                    return (
                      <div key={c.variant.id} className="flex items-center gap-3 p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.productName}</p>
                          {attrLabel && (
                            <p className="text-xs text-muted-foreground">{attrLabel}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{c.variant.sku}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(c.variant.id, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm font-medium">{c.quantity}</span>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(c.variant.id, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-right min-w-[4rem]">
                          <p className="text-sm font-medium">{fmt(c.quantity * c.price)}</p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeFromCart(c.variant.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t p-4 space-y-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{fmt(total)}</span>
                  </div>
                  <Button onClick={checkout} disabled={processSale.isPending} size="lg" className="w-full">
                    {processSale.isPending ? "Processing..." : "Checkout"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <VariantSelectorModal
        product={selectedProduct}
        open={variantModalOpen}
        onOpenChange={setVariantModalOpen}
        onSelectVariant={(v) => addVariantToCart(v, selectedProduct?.name)}
      />
    </div>
  );
}
