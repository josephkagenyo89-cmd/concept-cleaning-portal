import goldBefore from "@/assets/gold_home_before.webp";
import goldAfter from "@/assets/gold_home_after.webp";
import platinumBefore from "@/assets/platinum_home_before.webp";
import platinumAfter from "@/assets/platinum_home_after.webp";
import ultimateBefore from "@/assets/ultimate_home_before.webp";
import ultimateAfter from "@/assets/ultimate_home_after.webp";
import carBefore from "@/assets/car_detailing_before.webp";
import carAfter from "@/assets/car_detailing_after.webp";
import ImageCompareSlider from "@/components/ImageCompareSlider";

interface PackageComparisonProps {
  serviceName: string;
  description?: string | null;
  className?: string;
}

const packageVisuals = {
  gold: { before: goldBefore, after: goldAfter },
  platinum: { before: platinumBefore, after: platinumAfter },
  ultimate: { before: ultimateBefore, after: ultimateAfter },
  car: { before: carBefore, after: carAfter },
};

const getVisualKey = (serviceName: string, description = ""): keyof typeof packageVisuals => {
  const text = `${serviceName} ${description}`.toLowerCase();
  if (/car|detailing|vehicle/.test(text)) return "car";
  if (text.includes("ultimate")) return "ultimate";
  if (text.includes("platinum")) return "platinum";
  if (text.includes("gold")) return "gold";
  return "platinum";
};

const PackageComparison = ({ serviceName, description, className = "" }: PackageComparisonProps) => {
  const visual = packageVisuals[getVisualKey(serviceName, description ?? "")];
  const comparison = {
    id: serviceName,
    label: `${serviceName} example`,
    beforeImage: visual.before,
    afterImage: visual.after,
    beforeAlt: `Illustrative before image for ${serviceName}`,
    afterAlt: `Illustrative after image for ${serviceName}`,
  };

  return (
    <div className={className}>
      <ImageCompareSlider comparisons={[comparison]} aspectClassName="aspect-[4/3]" />
      <p className="mt-2 text-xs text-muted-foreground">
        Illustrative example; these are not photographs of Concept client work.
      </p>
    </div>
  );
};

export default PackageComparison;