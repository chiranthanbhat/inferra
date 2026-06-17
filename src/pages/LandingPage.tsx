import { Navbar, Hero, Features, HowItWorks, Security, Pricing, Footer } from '../components/landing';
import { Calculator } from '../components/landing/Calculator';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-navy-950">
      <Navbar />
      <Hero />
      <HowItWorks />
      <Calculator />
      <Features />
      <Security />
      <Pricing />
      <Footer />
    </div>
  );
}
