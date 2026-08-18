import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AdminDashboardPage() {
  return (
    <>
      <h1>Dashboard</h1>
      <p className="admin-main__subtitle">Manage the catalog, compatibility rules, designs, and incoming orders.</p>

      <div className="admin-card">
        <p>
          Start by populating the <Link href="/admin/catalog">catalog</Link> (sizes, cake types,
          flavors, fillings, frostings, decorations) and any{" "}
          <Link href="/admin/constraints">constraints</Link> between them.
        </p>
      </div>
    </>
  );
}
