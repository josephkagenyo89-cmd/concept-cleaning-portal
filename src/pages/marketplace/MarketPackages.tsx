import { Helmet } from 'react-helmet-async';
import MarketPackagesSection from '@/components/marketplace/MarketPackagesSection';

export default function MarketPackages() {
  return (
    <>
      <Helmet>
        <title>Cleaning Packages | Concept Cleaning Services</title>
        <meta name="description" content="Explore live cleaning and pest-control packages from Concept Cleaning Services. Compare inclusions, see approved package prices and request your package online." />
        <link rel="canonical" href="https://www.conceptcleaningservices.co.ke/packages" />
      </Helmet>
      <MarketPackagesSection variant="full" />
    </>
  );
}
