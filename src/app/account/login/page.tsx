import Link from "next/link";
import { login } from "../actions";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import "../account.css";

export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <>
      <Navbar />
      <main className="account-auth">
        <form className="account-auth__card" action={login}>
          <span className="section-eyebrow">Welcome Back</span>
          <h1>Log In</h1>
          <p>Log in to track your orders and check out faster.</p>

          {error && <p className="account-auth__error">Incorrect email or password. Try again.</p>}

          {next && <input type="hidden" name="next" value={next} />}

          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoFocus required />

          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required />

          <button type="submit" className="btn btn-primary">
            Log In
          </button>

          <p className="account-auth__switch">
            Don&apos;t have an account? <Link href="/account/signup">Sign up</Link>
          </p>
        </form>
      </main>
      <Footer />
    </>
  );
}
