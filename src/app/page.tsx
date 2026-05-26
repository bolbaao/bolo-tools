import Hero from "@/components/home/Hero";
import PageShell from "@/components/home/PageShell";
import ToolsSection from "@/components/ToolsSection";

export default function HomePage() {
  return (
    <PageShell>
      <div className="relative overflow-hidden">
        <Hero />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent reveal reveal-d2" />
        </div>
        <ToolsSection />
      </div>
    </PageShell>
  );
}
