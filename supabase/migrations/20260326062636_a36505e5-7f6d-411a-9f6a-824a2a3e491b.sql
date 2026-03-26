
-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'group_admin', 'user');

-- 2. Organizations table
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subscription_status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 3. Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  display_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. User roles table (separate as required)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. Organization features table
CREATE TABLE public.organization_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  feature_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  UNIQUE(organization_id, feature_name)
);
ALTER TABLE public.organization_features ENABLE ROW LEVEL SECURITY;

-- 6. Add organization_id to existing tables
ALTER TABLE public.products ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.transactions ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_logs ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.ledger_entries ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 7. Security definer functions
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin')
$$;

-- 8. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  
  -- Default role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. Drop old permissive RLS policies
DROP POLICY IF EXISTS "Anon can manage products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can manage products" ON public.products;
DROP POLICY IF EXISTS "Anon can manage transactions" ON public.transactions;
DROP POLICY IF EXISTS "Authenticated users can manage transactions" ON public.transactions;
DROP POLICY IF EXISTS "Anon can manage inventory_logs" ON public.inventory_logs;
DROP POLICY IF EXISTS "Authenticated users can manage inventory_logs" ON public.inventory_logs;
DROP POLICY IF EXISTS "Anon can manage ledger_entries" ON public.ledger_entries;
DROP POLICY IF EXISTS "Authenticated users can manage ledger_entries" ON public.ledger_entries;

-- 10. New org-scoped RLS policies for data tables
CREATE POLICY "Users see own org products" ON public.products
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users manage own org products" ON public.products
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users see own org transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users manage own org transactions" ON public.transactions
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users see own org inventory_logs" ON public.inventory_logs
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users manage own org inventory_logs" ON public.inventory_logs
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users see own org ledger_entries" ON public.ledger_entries
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users manage own org ledger_entries" ON public.ledger_entries
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) OR public.is_super_admin(auth.uid()));

-- 11. RLS for organizations
CREATE POLICY "Super admins manage all orgs" ON public.organizations
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Users see own org" ON public.organizations
  FOR SELECT TO authenticated
  USING (id = public.get_user_org_id(auth.uid()));

-- 12. RLS for profiles
CREATE POLICY "Users see own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR organization_id = public.get_user_org_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins manage org profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR
    (public.has_role(auth.uid(), 'group_admin') AND organization_id = public.get_user_org_id(auth.uid()))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.has_role(auth.uid(), 'group_admin') AND organization_id = public.get_user_org_id(auth.uid()))
  );

-- 13. RLS for user_roles
CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()) OR
    (public.has_role(auth.uid(), 'group_admin') AND
     user_id IN (SELECT id FROM public.profiles WHERE organization_id = public.get_user_org_id(auth.uid()))));

CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR
    (public.has_role(auth.uid(), 'group_admin') AND
     user_id IN (SELECT id FROM public.profiles WHERE organization_id = public.get_user_org_id(auth.uid()))))
  WITH CHECK (public.is_super_admin(auth.uid()) OR
    (public.has_role(auth.uid(), 'group_admin') AND
     user_id IN (SELECT id FROM public.profiles WHERE organization_id = public.get_user_org_id(auth.uid()))));

-- 14. RLS for organization_features
CREATE POLICY "Users see own org features" ON public.organization_features
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Admins manage org features" ON public.organization_features
  FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR
    (public.has_role(auth.uid(), 'group_admin') AND organization_id = public.get_user_org_id(auth.uid()))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.has_role(auth.uid(), 'group_admin') AND organization_id = public.get_user_org_id(auth.uid()))
  );

-- 15. Updated_at triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
