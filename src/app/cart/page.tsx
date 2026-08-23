import { loadOrderData, loadPickupAvailability } from "../../db/queries";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import CartView from "../../components/cart/CartView";
import "../../components/order/order-wizard.css";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const [{ fields, options, designSummaries, tierPresets }, availability] = await Promise.all([
    loadOrderData(),
    loadPickupAvailability(),
  ]);

  return (
    <>
      <Navbar />
      <CartView
        fields={fields}
        options={options}
        designs={designSummaries}
        tierPresets={tierPresets}
        availability={availability}
      />
      <Footer />
    </>
  );
}
