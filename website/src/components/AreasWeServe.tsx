import { MapPin } from "lucide-react";
import { motion } from "framer-motion";

const areas = [
  { county: "Nairobi", locations: ["Westlands", "Kilimani", "Karen", "Lavington", "Runda"] },
  { county: "Kiambu", locations: ["Ruaka", "Ruiru", "Thika"] },
  { county: "Kajiado", locations: ["Kitengela", "Ongata Rongai"] },
  { county: "Machakos", locations: ["Syokimau", "Athi River"] },
];

const AreasWeServe = () => (
  <section className="section-padding">
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl sm:text-4xl font-bold mb-3">Areas We Serve</h2>
        <p className="text-muted-foreground max-w-md mx-auto">Professional cleaning services across Nairobi and surrounding counties.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {areas.map((area, i) => (
          <motion.div
            key={area.county}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            className="p-5 rounded-2xl bg-card border border-border"
          >
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-lg">{area.county}</h3>
            </div>
            <ul className="space-y-1.5">
              {area.locations.map((loc) => (
                <li key={loc} className="text-muted-foreground text-sm">• {loc}</li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default AreasWeServe;
