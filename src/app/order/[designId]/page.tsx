import { notFound } from "next/navigation";
import { loadOrderData, loadPickupAvailability } from "../../../db/queries";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import OrderWizard from "../OrderWizard";
import "../../../components/order/order-wizard.css";

export const dynamic = "force-dynamic";

export default async function LockedDesignOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ designId: string }>;
  searchParams: Promise<{ size?: string }>;
}) {
  const { designId } = await params;
  const { size } = await searchParams;
  const id = Number(designId);
  if (!Number.isInteger(id)) notFound();

  const [{ fields, options, designSummaries, constraintPairsDTO, tierPresets, categories }, availability] =
    await Promise.all([loadOrderData(), loadPickupAvailability()]);
  const lockedDesign = designSummaries.find((d) => d.id === id);
  if (!lockedDesign) notFound();

  const initialSizeId = size ? Number(size) : undefined;

  return (
    <>
      <Navbar />
      <OrderWizard
        fields={fields}
        options={options}
        designs={designSummaries}
        constraintPairs={constraintPairsDTO}
        tierPresets={tierPresets}
        categories={categories}
        availability={availability}
        lockedDesign={lockedDesign}
        initialSizeId={initialSizeId && Number.isInteger(initialSizeId) ? initialSizeId : undefined}
      />
      <Footer />
    </>
  );
}
