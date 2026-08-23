import { redirect } from "next/navigation";

// Design selection is centralized on /gallery now — there's no more design-picker
// popup to land on here. Keep this route working for old links/bookmarks.
export default function OrderPage() {
  redirect("/gallery");
}
