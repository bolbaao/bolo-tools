import AboutSection from "@/components/home/AboutSection";
import Hero from "@/components/home/Hero";
import FeaturedToolsSection from "@/components/home/FeaturedToolsSection";
import PageShell from "@/components/home/PageShell";
export default function HomePage() {
  return (
    <PageShell>
      <div className="relative overflow-hidden">
        <Hero />
        <FeaturedToolsSection />
        <AboutSection />
      </div>
    </PageShell>
  );
}
