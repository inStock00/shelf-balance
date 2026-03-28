import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Plus, X, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateProduct } from "@/hooks/useInventory";

interface AttrDef {
  name: string;
  values: string[];
  currentValue: string;
}

interface VariantRow {
  sku: string;
  price_override: string;
  unit_cost: string;
  stock_quantity: string;
  reorder_point: string;
  optionValues: { attributeName: string; optionValue: string }[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddProductDialog({ open, onOpenChange }: Props) {
  const createProduct = useCreateProduct();
  const [hasVariants, setHasVariants] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "General",
    base_price: "",
    sku: "",
    unit_cost: "",
    stock_quantity: "",
    reorder_point: "10",
  });
  const [attrs, setAttrs] = useState<AttrDef[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);

  const resetForm = () => {
    setForm({ name: "", description: "", category: "General", base_price: "", sku: "", unit_cost: "", stock_quantity: "", reorder_point: "10" });
    setAttrs([]);
    setVariants([]);
    setHasVariants(false);
  };

  const addAttribute = () => {
    setAttrs([...attrs, { name: "", values: [], currentValue: "" }]);
  };

  const removeAttribute = (idx: number) => {
    setAttrs(attrs.filter((_, i) => i !== idx));
    setVariants([]);
  };

  const addOptionValue = (attrIdx: number) => {
    const attr = attrs[attrIdx];
    if (!attr.currentValue.trim()) return;
    if (attr.values.includes(attr.currentValue.trim())) return;
    setAttrs(
      attrs.map((a, i) =>
        i === attrIdx
          ? { ...a, values: [...a.values, a.currentValue.trim()], currentValue: "" }
          : a
      )
    );
    setVariants([]);
  };

  const removeOptionValue = (attrIdx: number, valIdx: number) => {
    setAttrs(
      attrs.map((a, i) =>
        i === attrIdx ? { ...a, values: a.values.filter((_, vi) => vi !== valIdx) } : a
      )
    );
    setVariants([]);
  };

  const generateVariants = () => {
    const validAttrs = attrs.filter((a) => a.name && a.values.length > 0);
    if (validAttrs.length === 0) {
      toast.error("Add at least one attribute with values");
      return;
    }

    // Cartesian product
    const combinations: { attributeName: string; optionValue: string }[][] = validAttrs.reduce<
      { attributeName: string; optionValue: string }[][]
    >(
      (acc, attr) => {
        if (acc.length === 0) {
          return attr.values.map((v) => [{ attributeName: attr.name, optionValue: v }]);
        }
        const result: { attributeName: string; optionValue: string }[][] = [];
        for (const existing of acc) {
          for (const v of attr.values) {
            result.push([...existing, { attributeName: attr.name, optionValue: v }]);
          }
        }
        return result;
      },
      []
    );

    const prefix = form.name ? form.name.substring(0, 3).toUpperCase() : "PRD";
    setVariants(
      combinations.map((combo, idx) => ({
        sku: `${prefix}-${combo.map((c) => c.optionValue.substring(0, 3).toUpperCase()).join("-")}-${String(idx + 1).padStart(3, "0")}`,
        price_override: form.base_price,
        unit_cost: form.unit_cost || "0",
        stock_quantity: "0",
        reorder_point: "10",
        optionValues: combo,
      }))
    );
  };

  const handleSave = async () => {
    if (!form.name) {
      toast.error("Product name is required");
      return;
    }

    try {
      if (hasVariants) {
        if (variants.length === 0) {
          toast.error("Generate variants first");
          return;
        }
        await createProduct.mutateAsync({
          name: form.name,
          description: form.description,
          category: form.category,
          base_price: parseFloat(form.base_price) || 0,
          has_variants: true,
          attributes: attrs
            .filter((a) => a.name && a.values.length > 0)
            .map((a) => ({ name: a.name, values: a.values })),
          variants: variants.map((v, idx) => ({
            sku: v.sku,
            price_override: v.price_override ? parseFloat(v.price_override) : undefined,
            unit_cost: parseFloat(v.unit_cost) || 0,
            stock_quantity: parseInt(v.stock_quantity) || 0,
            reorder_point: parseInt(v.reorder_point) || 10,
            optionIndices: [idx],
            optionValues: v.optionValues,
          })),
        });
      } else {
        if (!form.sku) {
          toast.error("SKU is required");
          return;
        }
        await createProduct.mutateAsync({
          name: form.name,
          description: form.description,
          category: form.category,
          base_price: parseFloat(form.base_price) || 0,
          has_variants: false,
          sku: form.sku,
          unit_cost: parseFloat(form.unit_cost) || 0,
          stock_quantity: parseInt(form.stock_quantity) || 0,
          reorder_point: parseInt(form.reorder_point) || 10,
        });
      }
      toast.success("Product created");
      resetForm();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Product</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional product description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Base Price</Label>
              <Input type="number" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} />
            </div>
            <div>
              <Label>Unit Cost</Label>
              <Input type="number" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
            </div>
          </div>

          {/* Variant Toggle */}
          <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
            <Switch checked={hasVariants} onCheckedChange={setHasVariants} />
            <div>
              <p className="text-sm font-medium">Has Variants</p>
              <p className="text-xs text-muted-foreground">Enable to add Size, Color, Material variations</p>
            </div>
          </div>

          {!hasVariants ? (
            /* Simple product fields */
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div>
                <Label>Initial Stock</Label>
                <Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
              </div>
              <div>
                <Label>Reorder Point</Label>
                <Input type="number" value={form.reorder_point} onChange={(e) => setForm({ ...form, reorder_point: e.target.value })} />
              </div>
            </div>
          ) : (
            /* Variant builder */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Attributes</Label>
                <Button variant="outline" size="sm" onClick={addAttribute}>
                  <Plus className="mr-1 h-3 w-3" /> Add Attribute
                </Button>
              </div>

              {attrs.map((attr, attrIdx) => (
                <div key={attrIdx} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Attribute name (e.g., Size)"
                      value={attr.name}
                      onChange={(e) =>
                        setAttrs(attrs.map((a, i) => (i === attrIdx ? { ...a, name: e.target.value } : a)))
                      }
                      className="flex-1"
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeAttribute(attrIdx)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add value (e.g., Large)"
                      value={attr.currentValue}
                      onChange={(e) =>
                        setAttrs(attrs.map((a, i) => (i === attrIdx ? { ...a, currentValue: e.target.value } : a)))
                      }
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOptionValue(attrIdx))}
                      className="flex-1"
                    />
                    <Button variant="secondary" size="sm" onClick={() => addOptionValue(attrIdx)}>
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {attr.values.map((v, vi) => (
                      <Badge key={vi} variant="secondary" className="gap-1">
                        {v}
                        <button onClick={() => removeOptionValue(attrIdx, vi)}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}

              {attrs.length > 0 && (
                <Button onClick={generateVariants} variant="outline" className="w-full">
                  <Wand2 className="mr-2 h-4 w-4" /> Generate SKU Combinations
                </Button>
              )}

              {variants.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Variant</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variants.map((v, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="flex gap-1">
                              {v.optionValues.map((ov, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {ov.optionValue}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={v.sku}
                              onChange={(e) =>
                                setVariants(variants.map((vr, i) => (i === idx ? { ...vr, sku: e.target.value } : vr)))
                              }
                              className="h-8 text-xs w-40"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              value={v.price_override}
                              onChange={(e) =>
                                setVariants(variants.map((vr, i) => (i === idx ? { ...vr, price_override: e.target.value } : vr)))
                              }
                              className="h-8 text-xs w-20 ml-auto"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              value={v.unit_cost}
                              onChange={(e) =>
                                setVariants(variants.map((vr, i) => (i === idx ? { ...vr, unit_cost: e.target.value } : vr)))
                              }
                              className="h-8 text-xs w-20 ml-auto"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              value={v.stock_quantity}
                              onChange={(e) =>
                                setVariants(variants.map((vr, i) => (i === idx ? { ...vr, stock_quantity: e.target.value } : vr)))
                              }
                              className="h-8 text-xs w-20 ml-auto"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={createProduct.isPending}>
            {createProduct.isPending ? "Saving..." : "Save Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
