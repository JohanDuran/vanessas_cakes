import { login } from "../actions";
import "./login.css";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <main className="admin-login">
      <form className="admin-login__card" action={login}>
        <span className="section-eyebrow">Owner Access</span>
        <h1>Admin Login</h1>
        <p>Enter the shop password to manage designs, catalog, and orders.</p>

        {error && <p className="admin-login__error">Incorrect password. Try again.</p>}

        {next && <input type="hidden" name="next" value={next} />}

        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoFocus required />

        <button type="submit" className="btn btn-primary">
          Log In
        </button>
      </form>
    </main>
  );
}
