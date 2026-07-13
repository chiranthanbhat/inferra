import { Navbar, Hero, Features, HowItWorks, SmartRouting, Security, Pricing, Footer } from '../components/landing';
import { Calculator } from '../components/landing/Calculator';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-bg overflow-x-hidden">
      <Navbar />
      <Hero />
      <HowItWorks />
      <SmartRouting />
      <Calculator />
      <Features />
      <Security />
      <Pricing />
      <Footer />
    </div>
  );
}
