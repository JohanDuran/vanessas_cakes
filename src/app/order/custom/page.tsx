import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { portfolioPhotos } from "../../../db/schema";
import { loadOrderData } from "../../../db/queries";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import OrderWizard from "../OrderWizard";
import "../../../components/order/order-wizard.css";

export const dynamic = "force-dynamic";

export default async function CustomCakeOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ portfolioPhotoId?: string }>;
}) {
  const { portfolioPhotoId } = await searchParams;
  const { fields, options, designSummaries, constraintPairsDTO, tierPresets } = await loadOrderData();

  // if the id is stale (photo already configured into a design, or deleted)
  // this just silently falls through to a normal custom quote — no error
  const id = portfolioPhotoId ? Number(portfolioPhotoId) : NaN;
  const photo = Number.isInteger(id)
    ? await db.select().from(portfolioPhotos).where(eq(portfolioPhotos.id, id)).then((r) => r[0])
    : undefined;

  // the two singleton quote-kind designs (see designs.kind) — configured for
  // fields via the same admin DesignForm as any catalog design
  const lockedDesign = designSummaries.find((d) => d.kind === (photo ? "custom_portfolio" : "custom"));

  return (
    <>
      <Navbar />
      <OrderWizard
        fields={fields}
        options={options}
        designs={designSummaries}
        constraintPairs={constraintPairsDTO}
        tierPresets={tierPresets}
        lockedDesign={lockedDesign}
        portfolioReferenceImage={photo ? { id: photo.id, path: photo.path } : undefined}
      />
      <Footer />
    </>
  );
}
