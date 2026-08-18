import { eq } from "drizzle-orm";
import { db } from "../../../../../db";
import { catalogItems } from "../../../../../db/schema";
import DesignForm from "../../../../../components/admin/DesignForm";

export const dynamic = "force-dynamic";

export default async function NewDesignPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const items = db.select().from(catalogItems).where(eq(catalogItems.active, true)).all();

  return (
    <>
      <h1>New Design</h1>
      <p className="admin-main__subtitle">
        Build the recipe with the quote tool, then set what was actually charged.
      </p>
      {error === "constraint" && (
        <div className="admin-error-banner">
          This recipe combines two items marked incompatible in Constraints — fix the recipe or
          remove that constraint first.
        </div>
      )}
      <DesignForm items={items} />
    </>
  );
}
