import { Phone, MapPin, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useState } from "react";
import PageHead from "@/components/PageHead";

const Contact = () => {
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Message sent! We'll get back to you soon.");
    setForm({ name: "", email: "", message: "" });
  };

  return (
    <div>
      <PageHead
        title="Contact Cleaning Services in Nairobi | Book Professional Cleaning"
        description="Get in touch with Concept Cleaning Services. Professional cleaning in Nairobi, Kiambu, Kajiado and Machakos. Call, WhatsApp or fill out our contact form."
        keywords="contact cleaning services Nairobi, book cleaning Nairobi, cleaning company phone"
        canonical="https://concept-cleaning-kenya.lovable.app/contact"
      />

      <section className="section-padding bg-foreground text-background pt-24 sm:pt-32">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
            <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">Get in <span className="text-primary">Touch</span></h1>
            <p className="text-background/60 text-lg">We'd love to hear from you.</p>
          </motion.div>
        </div>
      </section>

      <section className="section-padding">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl font-bold mb-6">Contact Information</h2>
            <div className="space-y-5 mb-8">
              <a href="tel:+254796563741" className="flex items-center gap-4 p-4 rounded-xl bg-muted hover:bg-muted/80 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center"><Phone className="w-5 h-5 text-accent-foreground" /></div>
                <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">+254 796 563 741</p></div>
              </a>
              <a href="https://wa.me/254796563741" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 rounded-xl bg-muted hover:bg-muted/80 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center"><MessageCircle className="w-5 h-5 text-accent-foreground" /></div>
                <div><p className="text-xs text-muted-foreground">WhatsApp</p><p className="font-medium">Chat with us</p></div>
              </a>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center"><MapPin className="w-5 h-5 text-accent-foreground" /></div>
                <div><p className="text-xs text-muted-foreground">Location</p><p className="font-medium">Nairobi, Kenya</p></div>
              </div>
            </div>
            <div className="rounded-2xl bg-muted h-48 flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Map — Nairobi, Kenya</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-6">Send a Message</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div><label className="text-sm font-medium mb-1.5 block">Name</label><Input placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div><label className="text-sm font-medium mb-1.5 block">Email</label><Input type="email" placeholder="you@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
              <div><label className="text-sm font-medium mb-1.5 block">Message</label><Textarea placeholder="How can we help?" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={5} required /></div>
              <Button type="submit" className="w-full" size="lg">Send Message</Button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
