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

            <button type="submit" className="btn btn-google">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.12-.84 2.07-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.87 2.68-6.61z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.19l-2.92-2.26c-.81.54-1.85.87-3.04.87-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A8.997 8.997 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.96A8.997 8.997 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.33z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A8.997 8.997 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
              </svg>
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
