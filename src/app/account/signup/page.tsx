import Link from "next/link";
import { signup } from "../actions";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import "../account.css";

const ERROR_MESSAGES: Record<string, string> = {
  taken: "An account with that email already exists.",
  invalid: "Please check the form — name, a valid email, and an 8+ character password are required.",
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
        <form className="account-auth__card" action={signup}>
          <span className="section-eyebrow">Join Us</span>
          <h1>Create Account</h1>
          <p>Sign up to save your info and see your order history.</p>

          {error && <p className="account-auth__error">{ERROR_MESSAGES[error] ?? "Something went wrong. Try again."}</p>}

          {next && <input type="hidden" name="next" value={next} />}

          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" autoFocus required />

          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required />

          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" minLength={8} required />

          <button type="submit" className="btn btn-primary">
            Sign Up
          </button>

          <p className="account-auth__switch">
            Already have an account? <Link href="/account/login">Log in</Link>
          </p>
        </form>
      </main>
      <Footer />
    </>
  );
}
