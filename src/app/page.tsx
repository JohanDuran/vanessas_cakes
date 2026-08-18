import Navbar from "../components/Navbar";
import HeroSlideshow from "../components/HeroSlideshow";
import StorySection from "../components/StorySection";
import GallerySection from "../components/GallerySection";
import ReviewsSection from "../components/ReviewsSection";
import Footer from "../components/Footer";
import FloatingOrderButton from "../components/FloatingOrderButton";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSlideshow />
        <StorySection />
        <GallerySection />
        <ReviewsSection />
      </main>
      <Footer />
      <FloatingOrderButton />
    </>
  );
}
