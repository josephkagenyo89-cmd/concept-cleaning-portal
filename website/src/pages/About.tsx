import { CheckCircle, Target, Eye } from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

const About = () => (
  <div>
    <section className="section-padding bg-foreground text-background pt-24 sm:pt-32">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-6">About <span className="text-primary">Concept</span></h1>
          <p className="text-background/60 text-lg leading-relaxed">
            We are a professional cleaning and car detailing company based in Nairobi, Kenya. Our mission is to deliver premium cleaning experiences that transform spaces and vehicles.
          </p>
        </motion.div>
      </div>
    </section>

    <section className="section-padding">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
            <Target className="w-6 h-6 text-accent-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
          <p className="text-muted-foreground leading-relaxed">
            To provide exceptional cleaning and detailing services using eco-friendly products and modern techniques. We aim to exceed expectations on every job.
          </p>
        </motion.div>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}>
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
            <Eye className="w-6 h-6 text-accent-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Our Vision</h2>
          <p className="text-muted-foreground leading-relaxed">
            To become East Africa's most trusted cleaning brand, known for quality, reliability, and customer satisfaction.
          </p>
        </motion.div>
      </div>
    </section>

    <section className="section-padding bg-muted/50">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-center">Why Choose Us</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            "Trained & vetted professionals",
            "Industry-grade equipment",
            "Eco-friendly cleaning products",
            "On-time guaranteed service",
            "Competitive pricing",
            "Satisfaction guaranteed",
          ].map((item, i) => (
            <motion.div
              key={item}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border"
            >
              <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <span className="font-medium text-sm">{item}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  </div>
);

export default About;
