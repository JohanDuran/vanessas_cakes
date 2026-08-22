import { loadOrderData, loadPickupAvailability } from "../../../db/queries";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import OrderWizard from "../OrderWizard";
import "../../../components/order/order-wizard.css";

export const dynamic = "force-dynamic";

export default async function CustomCakeOrderPage() {
  const [{ fields, options, designSummaries, constraintPairsDTO, tierPresets }, availability] = await Promise.all([
    loadOrderData(),
    loadPickupAvailability(),
  ]);

  return (
    <>
      <Navbar />
      <OrderWizard
        fields={fields}
        options={options}
        designs={designSummaries}
        constraintPairs={constraintPairsDTO}
        tierPresets={tierPresets}
        availability={availability}
        startCustom
      />
      <Footer />
    </>
  );
}
