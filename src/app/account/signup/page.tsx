import Link from "next/link";
import { signup, loginWithGoogle } from "../actions";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import "../account.css";

const ERROR_MESSAGES: Record<string, string> = {
  taken: "An account with that email already exists.",
  invalid: "Please check the form — all fields are required, including a valid email, a valid phone number, and an 8+ character password.",
  mismatch: "Passwords do not match.",
};

export default async function AccountSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <>
      <Navbar />
      <main className="account-auth">
        <div className="account-auth__card">
          <form action={signup}>
            <span className="section-eyebrow">Join Us</span>
            <h1>Create Account</h1>
            <p>Sign up to save your info and see your order history.</p>

            {error && <p className="account-auth__error">{ERROR_MESSAGES[error] ?? "Something went wrong. Try again."}</p>}

            {next && <input type="hidden" name="next" value={next} />}

            <label htmlFor="name">Name</label>
            <input id="name" name="name" type="text" autoFocus required />

            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required />

            <label htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              pattern="\+?[0-9\s().-]{7,20}"
              title="Enter a valid phone number"
              required
            />

            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" minLength={8} required />

            <label htmlFor="confirmPassword">Verify Password</label>
            <input id="confirmPassword" name="confirmPassword" type="password" minLength={8} required />

            <label className="account-auth__checkbox" htmlFor="marketingOptIn">
              <input id="marketingOptIn" name="marketingOptIn" type="checkbox" defaultChecked />
              I&apos;d like to receive promotional emails and texts from Vanessa&apos;s Cakes.
            </label>

            <button type="submit" className="btn btn-primary">
              Sign Up
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
            Already have an account? <Link href="/account/login">Log in</Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
