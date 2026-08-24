import { getCurrentUser, loadAllUsers } from "../../../../db/queries";
import { promoteToAdmin, demoteFromAdmin } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const [allUsers, me] = await Promise.all([loadAllUsers(), getCurrentUser()]);
  const adminCount = allUsers.filter((u) => u.isAdmin).length;

  return (
    <>
      <h1>Admins</h1>
      <p className="admin-main__subtitle">
        Anyone with an account can be granted admin access, which unlocks this whole section. At
        least one admin must always exist.
      </p>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.name}
                  {u.id === me?.id && " (you)"}
                </td>
                <td>{u.email}</td>
                <td>{u.isAdmin ? "Admin" : "Customer"}</td>
                <td>
                  {u.isAdmin ? (
                    <form action={demoteFromAdmin}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button
                        type="submit"
                        className="admin-btn-sm admin-btn-sm--danger"
                        disabled={adminCount <= 1}
                        title={adminCount <= 1 ? "At least one admin must exist" : undefined}
                      >
                        Remove Admin
                      </button>
                    </form>
                  ) : (
                    <form action={promoteToAdmin}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button type="submit" className="admin-btn-sm admin-btn-sm--ghost">
                        Make Admin
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {allUsers.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: "var(--text-soft)" }}>
                  No accounts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
