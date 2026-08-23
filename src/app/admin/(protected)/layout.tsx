import AdminSidebar from "../../../components/admin/AdminSidebar";
import ToastHost from "../../../components/admin/ToastHost";
import "../admin.css";

export default function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <AdminSidebar />
      <main className="admin-main">{children}</main>
      <ToastHost />
    </div>
  );
}
