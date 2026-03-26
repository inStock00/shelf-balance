import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Users, UserPlus, Shield, Building2 } from "lucide-react";
import { toast } from "sonner";

type AppRole = "super_admin" | "group_admin" | "user";

export default function UserManagement() {
  const { organizationId, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("user");

  // Fetch all organizations (for super admins to reassign users)
  const { data: allOrgs } = useQuery({
    queryKey: ["all-organizations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  const { data: orgUsers, isLoading } = useQuery({
    queryKey: ["org-users", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("organization_id", organizationId);
      if (error) throw error;

      // Fetch roles for these users
      const userIds = profiles.map((p: any) => p.id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      return profiles.map((p: any) => ({
        ...p,
        roles: (roles || []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role),
      }));
    },
    enabled: !!organizationId,
  });

  const updateRole = async (userId: string, newRole: AppRole) => {
    // Remove existing roles except super_admin (only super admins can assign that)
    const { error: delErr } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .neq("role", "super_admin");
    if (delErr) {
      toast.error(delErr.message);
      return;
    }

    const { error: insErr } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: newRole }, { onConflict: "user_id,role" });
    if (insErr) {
      toast.error(insErr.message);
      return;
    }

    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["org-users"] });
  };

  const handleInvite = async () => {
    // Sign up the user via edge function or manual – for now show instructions
    toast.info("Share this link with the user to sign up, then assign them to your organization.");
    setInviteOpen(false);
  };

  const roleBadgeVariant = (role: string) => {
    switch (role) {
      case "super_admin": return "destructive" as const;
      case "group_admin": return "default" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-muted-foreground" />
          <div>
            <h2 className="text-2xl font-bold">User Management</h2>
            <p className="text-sm text-muted-foreground">Manage users in your organization</p>
          </div>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> Invite User
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !orgUsers?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="mb-2 h-10 w-10" />
              <p>No users found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgUsers.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.display_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {u.roles.map((r: string) => (
                          <Badge key={r} variant={roleBadgeVariant(r)}>{r.replace("_", " ")}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.roles.find((r: string) => r !== "super_admin") || "user"}
                        onValueChange={(v) => updateRole(u.id, v as AppRole)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="group_admin">Admin</SelectItem>
                          {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Standard User</SelectItem>
                  <SelectItem value="group_admin">Group Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite}>Send Invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
