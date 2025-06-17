
import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminService, AdminUser } from "@/services/adminService";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useAdminTranslation } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Shield, ShieldOff } from "lucide-react";
import { AppRole } from "@/types/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UsersManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const { t } = useAdminTranslation();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const userData = await adminService.getAllUsers();
      setUsers(userData);
    } catch (error: any) {
      toast({
        title: t("errors.title"),
        description: error.message || t("errors.loadUsersFailed"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleUpdate = async (userId: string, newRole: AppRole) => {
    try {
      await adminService.updateUserRole(userId, newRole);
      toast({
        title: "Success",
        description: `User role updated to ${newRole}`,
      });
      // Refresh the users list
      fetchUsers();
      setRoleDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    }
  };

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.first_name?.toLowerCase().includes(searchTerm.toLowerCase() || '') ||
    user.last_name?.toLowerCase().includes(searchTerm.toLowerCase() || '')
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">
          Manage user accounts and permissions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("users.table.email")}</TableHead>
                    <TableHead>{t("users.table.name")}</TableHead>
                    <TableHead>{t("users.table.role")}</TableHead>
                    <TableHead>{t("users.table.createdAt")}</TableHead>
                    <TableHead>{t("users.table.lastLogin")}</TableHead>
                    <TableHead>{t("users.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{user.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.first_name ? `${user.first_name} ${user.last_name || ''}` : '—'}
                        </TableCell>
                        <TableCell>
                          {user.roles && user.roles.length > 0 ? (
                            user.roles.map((role) => (
                              <Badge 
                                key={role}
                                variant={role === 'admin' ? 'default' : 'outline'}
                              >
                                {role}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline">user</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell>
                          {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell>
                          <Dialog open={roleDialogOpen && selectedUser?.id === user.id} onOpenChange={(open) => {
                            setRoleDialogOpen(open);
                            if (!open) setSelectedUser(null);
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setRoleDialogOpen(true);
                                }}
                              >
                                Change Role
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Update User Role</DialogTitle>
                                <DialogDescription>
                                  Change the role for {selectedUser?.email}. This will affect their permissions.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="flex flex-col gap-4 py-4">
                                <div className="flex items-center gap-4">
                                  <Button
                                    variant={
                                      user.roles?.includes('admin') ? "default" : "outline"
                                    }
                                    onClick={() => handleRoleUpdate(user.id, 'admin')}
                                    className="flex-1"
                                  >
                                    <Shield className="mr-2 h-4 w-4" />
                                    Admin
                                  </Button>
                                  <Button
                                    variant={
                                      user.roles?.includes('admin') ? "outline" : "default"
                                    }
                                    onClick={() => handleRoleUpdate(user.id, 'user')}
                                    className="flex-1"
                                  >
                                    <ShieldOff className="mr-2 h-4 w-4" />
                                    User
                                  </Button>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
                                  Cancel
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4">
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
