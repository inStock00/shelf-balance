
-- Add new columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS base_price numeric NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants boolean NOT NULL DEFAULT false;

-- Create attributes table
CREATE TABLE IF NOT EXISTS attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name, organization_id)
);

ALTER TABLE attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own org attributes" ON attributes FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users manage own org attributes" ON attributes FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) OR organization_id = get_user_org_id(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) OR organization_id = get_user_org_id(auth.uid()));

-- Create attribute_options table
CREATE TABLE IF NOT EXISTS attribute_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id uuid NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  value text NOT NULL,
  UNIQUE(attribute_id, value)
);

ALTER TABLE attribute_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own org attribute_options" ON attribute_options FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid()) OR
    attribute_id IN (SELECT id FROM attributes WHERE organization_id = get_user_org_id(auth.uid()))
  );

CREATE POLICY "Users manage own org attribute_options" ON attribute_options FOR ALL TO authenticated
  USING (
    is_super_admin(auth.uid()) OR
    attribute_id IN (SELECT id FROM attributes WHERE organization_id = get_user_org_id(auth.uid()))
  )
  WITH CHECK (
    is_super_admin(auth.uid()) OR
    attribute_id IN (SELECT id FROM attributes WHERE organization_id = get_user_org_id(auth.uid()))
  );

-- Create product_variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku text NOT NULL,
  price_override numeric,
  unit_cost numeric NOT NULL DEFAULT 0,
  stock_quantity integer NOT NULL DEFAULT 0,
  reorder_point integer NOT NULL DEFAULT 10,
  barcode text,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own org variants" ON product_variants FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users manage own org variants" ON product_variants FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) OR organization_id = get_user_org_id(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) OR organization_id = get_user_org_id(auth.uid()));

-- Create variant_attribute_values junction table
CREATE TABLE IF NOT EXISTS variant_attribute_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  attribute_option_id uuid NOT NULL REFERENCES attribute_options(id) ON DELETE CASCADE,
  UNIQUE(variant_id, attribute_option_id)
);

ALTER TABLE variant_attribute_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own org vav" ON variant_attribute_values FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid()) OR
    variant_id IN (SELECT id FROM product_variants WHERE organization_id = get_user_org_id(auth.uid()))
  );

CREATE POLICY "Users manage own org vav" ON variant_attribute_values FOR ALL TO authenticated
  USING (
    is_super_admin(auth.uid()) OR
    variant_id IN (SELECT id FROM product_variants WHERE organization_id = get_user_org_id(auth.uid()))
  )
  WITH CHECK (
    is_super_admin(auth.uid()) OR
    variant_id IN (SELECT id FROM product_variants WHERE organization_id = get_user_org_id(auth.uid()))
  );

-- Add variant_id to inventory_logs
ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL;

-- Add updated_at trigger for product_variants
CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing products: set base_price from selling_price
UPDATE products SET base_price = selling_price WHERE base_price = 0 AND selling_price > 0;

-- Create default variants for existing products that don't have variants yet
INSERT INTO product_variants (product_id, sku, unit_cost, stock_quantity, reorder_point, organization_id, price_override)
SELECT p.id, p.sku, p.unit_cost, p.current_stock, p.reorder_point, p.organization_id, p.selling_price
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id
);
