import HeroSection from '../../components/landing/HeroSection';
import FeaturesSection from '../../components/landing/FeaturesSection';
import DashboardPreview from '../../components/landing/DashboardPreview';
import UniversitySection from '../../components/landing/UniversitySection';
import RoleOverview from '../../components/landing/RoleOverview';
import StatisticsSection from '../../components/landing/StatisticsSection';
import TestimonialsSection from '../../components/landing/TestimonialsSection';
import FAQSection from '../../components/landing/FAQSection';
import CTASection from '../../components/landing/CTASection';

export default function Landing() {
  return (
    <div className="bg-white">
      <HeroSection />
      <FeaturesSection />
      <DashboardPreview />
      <UniversitySection />
      <RoleOverview />
      <StatisticsSection />
      <TestimonialsSection />
      <FAQSection />
      <CTASection />
    </div>
  );
}
