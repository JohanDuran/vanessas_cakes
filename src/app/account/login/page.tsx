import Link from "next/link";
import { login, loginWithGoogle } from "../actions";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import "../account.css";

export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; next?: string }>;
}) {
  const { error, notice, next } = await searchParams;

  return (
    <>
      <Navbar />
      <main className="account-auth">
        <div className="account-auth__card">
          <form action={login}>
            <span className="section-eyebrow">Welcome Back</span>
            <h1>Log In</h1>
            <p>Log in to track your orders and check out faster.</p>

            {notice === "confirm-email" && (
              <p className="account-auth__error">Almost there — check your email for a confirmation link before logging in.</p>
            )}
            {error && <p className="account-auth__error">Incorrect email or password. Try again.</p>}

            {next && <input type="hidden" name="next" value={next} />}

            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoFocus required />

            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required />

            <button type="submit" className="btn btn-primary">
              Log In
            </button>
          </form>

          <div className="account-auth__divider">or</div>

          <form action={loginWithGoogle}>
            {next && <input type="hidden" name="next" value={next} />}

            <button type="submit" className="btn btn-outline">
              Continue with Google
            </button>
          </form>

          <p className="account-auth__switch">
            Don&apos;t have an account? <Link href="/account/signup">Sign up</Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
