import Navbar from "../components/Navbar";
import HeroSlideshow from "../components/HeroSlideshow";
import StorySection from "../components/StorySection";
import ReviewsSection from "../components/ReviewsSection";
import Footer from "../components/Footer";
import FloatingOrderButton from "../components/FloatingOrderButton";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSlideshow />
        <StorySection />
        <ReviewsSection />
      </main>
      <Footer />
      <FloatingOrderButton />
    </>
  );
}
