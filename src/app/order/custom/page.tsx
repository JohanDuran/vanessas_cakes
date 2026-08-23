import { loadOrderData } from "../../../db/queries";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import OrderWizard from "../OrderWizard";
import "../../../components/order/order-wizard.css";

export const dynamic = "force-dynamic";

export default async function CustomCakeOrderPage() {
  const { fields, options, designSummaries, constraintPairsDTO, tierPresets } = await loadOrderData();

  return (
    <>
      <Navbar />
      <OrderWizard
        fields={fields}
        options={options}
        designs={designSummaries}
        constraintPairs={constraintPairsDTO}
        tierPresets={tierPresets}
        startCustom
      />
      <Footer />
    </>
  );
}
