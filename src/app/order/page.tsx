import { loadOrderData } from "../../db/queries";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import OrderWizard from "./OrderWizard";
import "../../components/order/order-wizard.css";

export const dynamic = "force-dynamic";

export default async function OrderPage() {
  const { fields, options, designSummaries, constraintPairsDTO } = await loadOrderData();

  return (
    <>
      <Navbar />
      <OrderWizard fields={fields} options={options} designs={designSummaries} constraintPairs={constraintPairsDTO} />
      <Footer />
    </>
  );
}
