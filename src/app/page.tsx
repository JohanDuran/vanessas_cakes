import Navbar from "../components/Navbar";
import HeroSlideshow from "../components/HeroSlideshow";
import StorySection from "../components/StorySection";
import SocialSection from "../components/SocialSection";
import Footer from "../components/Footer";
import FloatingOrderButton from "../components/FloatingOrderButton";
import PromoModal from "../components/PromoModal";
import { loadFeaturedDesigns, loadStoryContent, loadPromoContent } from "../db/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [featured, story, promo] = await Promise.all([
    loadFeaturedDesigns(),
    loadStoryContent(),
    loadPromoContent(),
  ]);

  return (
    <>
      <Navbar />
      <main>
        <HeroSlideshow featured={featured} />
        <StorySection
          heading={story.heading}
          paragraph1={story.paragraph1}
          paragraph2={story.paragraph2}
          imagePath={story.imagePath}
          stats={story.stats}
        />
        <SocialSection />
      </main>
      <Footer />
      <FloatingOrderButton />
      <PromoModal imagePath={promo.imagePath} imageAlt={promo.imageAlt} />
    </>
  );
}
