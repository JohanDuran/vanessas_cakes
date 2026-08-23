import Navbar from "../components/Navbar";
import HeroSlideshow from "../components/HeroSlideshow";
import StorySection from "../components/StorySection";
import ReviewsSection from "../components/ReviewsSection";
import Footer from "../components/Footer";
import FloatingOrderButton from "../components/FloatingOrderButton";
import { loadFeaturedDesigns } from "../db/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const featured = await loadFeaturedDesigns();

  return (
    <>
      <Navbar />
      <main>
        <HeroSlideshow featured={featured} />
        <StorySection />
        <ReviewsSection />
      </main>
      <Footer />
      <FloatingOrderButton />
    </>
  );
}
