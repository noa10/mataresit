
import AdminLayout from "@/components/admin/AdminLayout";
import { Outlet } from "react-router-dom";

export default function AdminLayoutPage() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}
