import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/landing/Hero";
import { FinalCta, Honest, HowItWorks, Pillars, Privacy } from "@/components/landing/Sections";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col overflow-x-clip">
      <Navbar />
      <Hero />
      <Pillars />
      <Honest />
      <HowItWorks />
      <Privacy />
      <FinalCta />
      <Footer />
    </main>
  );
}
