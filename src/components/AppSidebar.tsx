import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  FileText,
  Settings,
  Users,
  Building2,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOrgFeatures } from "@/hooks/useFeatures";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isSuperAdmin, isGroupAdmin, profile, signOut } = useAuth();
  const { data: features } = useOrgFeatures();

  const mainNav = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, always: true },
    { title: "Inventory", url: "/inventory", icon: Package, feature: "inventory" as const },
    { title: "Sales / POS", url: "/sales", icon: ShoppingCart, feature: "pos" as const },
    { title: "Purchases", url: "/purchases", icon: Truck, feature: "purchases" as const },
    { title: "Reports", url: "/reports", icon: FileText, feature: "reports" as const },
  ];

  const adminNav = [
    ...(isSuperAdmin ? [{ title: "Organizations", url: "/admin/organizations", icon: Building2 }] : []),
    ...(isSuperAdmin || isGroupAdmin
      ? [
          { title: "Users", url: "/admin/users", icon: Users },
          { title: "Features", url: "/admin/features", icon: Settings },
        ]
      : []),
  ];

  const visibleMain = mainNav.filter(
    (item) => item.always || !item.feature || features?.[item.feature] !== false
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Package className="h-7 w-7 text-sidebar-primary" />
            <span className="text-lg font-bold text-sidebar-accent-foreground tracking-tight">
              StockLedger
            </span>
          </div>
        )}
        {collapsed && <Package className="h-7 w-7 text-sidebar-primary mx-auto" />}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {adminNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-3">
        {!collapsed && profile && (
          <div className="mb-2 px-2 text-xs text-sidebar-foreground/60 truncate">
            {profile.display_name || profile.email}
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && "Sign Out"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
