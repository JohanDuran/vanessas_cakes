import Link from "next/link";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import Donut from "../../../components/Donut";
import "../../../components/order/order-wizard.css";

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  return (
    <>
      <Navbar />
      <main className="order-page">
        <div className="container order-thankyou">
          <Donut size={70} rotate={-10} />
          <span className="section-eyebrow">Order Sent</span>
          <h1>Thank you! Your cake is on its way to the baker.</h1>
          <p>
            {id ? `Order #${id} has` : "Your order has"} been received. We&apos;ll reach out at the
            email you provided to confirm details and pricing.
          </p>
          <Link href="/" className="btn btn-primary">
            Back to Home
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
