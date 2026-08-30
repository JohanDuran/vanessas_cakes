import Navbar from "../components/Navbar";
import HeroSlideshow from "../components/HeroSlideshow";
import StorySection from "../components/StorySection";
import SocialSection from "../components/SocialSection";
import Footer from "../components/Footer";
import FloatingOrderButton from "../components/FloatingOrderButton";
import { loadFeaturedDesigns, loadStoryContent } from "../db/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [featured, story] = await Promise.all([loadFeaturedDesigns(), loadStoryContent()]);

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
    </>
  );
}
