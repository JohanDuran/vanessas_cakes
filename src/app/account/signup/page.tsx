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

            <button type="submit" className="btn btn-outline">
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
