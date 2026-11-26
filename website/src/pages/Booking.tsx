import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, differenceInDays, parseISO, addDays } from "date-fns";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Home, Building2, Car, Store, Plus, Check, Sparkles, ArrowRight, ArrowLeft,
  CheckCircle, MessageCircle, Calendar as CalIcon, CreditCard, Banknote,
  Smartphone, Wallet, Gift, Clock, Sofa, MapPin, Loader2, Download, LockKeyhole,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { whatsappLink } from "@/lib/whatsapp";
import { clearERPSubmissionId, fetchERPServices, getERPSubmissionId, submitERPServiceRequest } from "@/lib/erp-service-intake";
import { calculatePricing, tierDiscountPct, formatKES, type ServiceLine } from "@/lib/pricing";

const GoogleMark = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
);

const STEPS = [
  { id: 1, label: "Property" },
  { id: 2, label: "Services" },
  { id: 3, label: "Assets" },
  { id: 4, label: "Suggestions" },
  { id: 5, label: "Date & Time" },
  { id: 6, label: "Payment" },
  { id: 7, label: "Confirm" },
];

const PROPERTY_TYPES = ["Home", "Office", "Airbnb", "Commercial", "Vehicle"];
const TIME_SLOTS = [
  { label: "Morning", value: "9:00 AM", group: "Morning" },
  { label: "Late Morning", value: "11:00 AM", group: "Morning" },
  { label: "Afternoon", value: "1:00 PM", group: "Afternoon" },
  { label: "Mid Afternoon", value: "3:00 PM", group: "Afternoon" },
  { label: "Evening", value: "5:00 PM", group: "Evening" },
  { label: "Emergency ASAP", value: "ASAP", group: "Emergency" },
];

const PAYMENT_METHODS = [
  { id: "pay-after", label: "Pay After Service", icon: Wallet, desc: "Cash or M-Pesa upon completion" },
  { id: "mpesa", label: "M-Pesa", icon: Smartphone, desc: "Paybill 4703932 · Account: your phone" },
  { id: "card", label: "Card", icon: CreditCard, desc: "Secure card payment link sent via SMS" },
  { id: "bank", label: "Bank Transfer", icon: Banknote, desc: "Details shared on confirmation" },
  { id: "corporate", label: "Corporate Account", icon: Building2, desc: "Bill to your company on LPO" },
];

const iconForProperty = (t: string) => t === "Office" ? Building2 : t === "Vehicle" ? Car : t === "Commercial" ? Store : Home;

const iconMap: Record<string, any> = { Home, Sparkles, Sofa, Car, MapPin };

const Booking = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [step, setStep] = useState(1);
  const [services, setServices] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Wizard state
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [guestInfo, setGuestInfo] = useState({ name: "", phone: "", address: "", county: "", estate: "" });
  const [addingProperty, setAddingProperty] = useState(false);
  const [newProperty, setNewProperty] = useState<any>({ name: "", type: "Home", county: "", estate: "", address: "" });
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [serviceQty, setServiceQty] = useState<Record<string, number>>({});
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [appliedRecs, setAppliedRecs] = useState<string[]>([]);
  const [date, setDate] = useState<Date>();
  const [timeSlot, setTimeSlot] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("pay-after");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ number: string } | null>(null);
  // Load catalog & user data
  useEffect(() => {
    (async () => {
      setLoadingCatalog(true);
      try {
        const [svc, prop, ast] = await Promise.all([
          fetchERPServices(),
          user ? supabase.from("customer_properties").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [] as any[] }),
          user ? supabase.from("customer_property_assets").select("*, customer_properties(name)").order("created_at", { ascending: false }) : Promise.resolve({ data: [] as any[] }),
        ]);
        setServices(svc ?? []);
        setProperties(prop.data ?? []);
        setAssets(ast.data ?? []);

        const preselect = searchParams.get("service");
        if (preselect) {
          const found = (svc ?? []).find((s: any) => s.name === preselect);
          if (found) setSelectedServices([found.id]);
        }
      } catch (error: any) {
        console.error(error);
        toast.error(error.message || "Unable to load services. Please try again.");
        setServices([]);
      } finally {
        setLoadingCatalog(false);
      }
    })();
  }, [user, searchParams]);

  // Preload from profile for guest fields
  useEffect(() => {
    if (profile) {
      setGuestInfo(g => ({
        ...g,
        name: g.name || profile.full_name || "",
        phone: g.phone || profile.phone || "",
        address: g.address || profile.address || "",
      }));
    }
  }, [profile]);

  // Auto-select first property if only one
  useEffect(() => {
    if (user && properties.length === 1 && !propertyId) setPropertyId(properties[0].id);
  }, [properties, user, propertyId]);

  const currentProperty = properties.find(p => p.id === propertyId);
  const propertyAssets = assets.filter(a => a.property_id === propertyId);

  // Pricing
  const serviceLines: ServiceLine[] = useMemo(() => {
    return selectedServices.map(id => {
      const s = services.find(x => x.id === id);
      return {
        name: s?.name ?? "",
        description: s?.description ?? "",
        quantity: serviceQty[id] ?? 1,
        unitPrice: Number(s?.price_value ?? 0),
      };
    }).filter(l => l.name);
  }, [selectedServices, serviceQty, services]);

  const membershipPct = tierDiscountPct(profile?.membership_tier as string);
  const bundlePct = appliedRecs.includes("bundle-10") ? 10 : 0;
  const pricing = useMemo(() => calculatePricing({
    services: serviceLines,
    transport: 500,
    membershipDiscountPct: membershipPct,
    bundleDiscountPct: bundlePct,
  }), [serviceLines, membershipPct, bundlePct]);

  // Recommendations
  const recommendations = useMemo(() => {
    const recs: { id: string; title: string; reason: string; action?: string; discount?: number }[] = [];
    // Stale assets (>180 days)
    propertyAssets.forEach(a => {
      if (a.last_cleaned_at) {
        const days = differenceInDays(new Date(), parseISO(a.last_cleaned_at));
        if (days > 180) {
          recs.push({
            id: `stale-${a.id}`,
            title: `${a.name} needs attention`,
            reason: `Last cleaned ${Math.round(days / 30)} months ago`,
          });
        }
      }
    });
    // Bundle: if 2+ services selected, offer 10% off
    if (selectedServices.length >= 2) {
      recs.push({
        id: "bundle-10",
        title: "Bundle & Save",
        reason: `Booking ${selectedServices.length} services — enjoy 10% off`,
        discount: 10,
      });
    }
    // Pest reminder if no pest history in 12 months (simple heuristic)
    if (currentProperty && !selectedServices.some(id => services.find(s => s.id === id)?.name?.toLowerCase().includes("pest"))) {
      const hasPest = services.find(s => s.name?.toLowerCase().includes("fumig") || s.name?.toLowerCase().includes("pest"));
      if (hasPest) {
        recs.push({
          id: `pest-${hasPest.id}`,
          title: "Annual Pest Inspection",
          reason: "Recommended once a year for a healthy home",
          action: `add-service:${hasPest.id}`,
        });
      }
    }
    return recs;
  }, [propertyAssets, selectedServices, services, currentProperty]);

  const toggleService = (id: string) => {
    setSelectedServices(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
    setServiceQty(q => ({ ...q, [id]: q[id] ?? 1 }));
  };

  const toggleAsset = (id: string) => {
    setSelectedAssetIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const applyRec = (rec: any) => {
    setAppliedRecs(r => r.includes(rec.id) ? r : [...r, rec.id]);
    if (rec.action?.startsWith("add-service:")) {
      const sid = rec.action.split(":")[1];
      if (!selectedServices.includes(sid)) toggleService(sid);
    }
    toast.success("Added to your booking");
  };

  const canProceed = () => {
    if (step === 1) return user ? !!propertyId || addingProperty && newProperty.name : !!guestInfo.name && !!guestInfo.phone && !!guestInfo.address;
    if (step === 2) return selectedServices.length > 0;
    if (step === 5) return !!date && !!timeSlot;
    return true;
  };

  const next = async () => {
    if (!canProceed()) { toast.error("Please complete this step"); return; }
    // If adding a new property inline, save it now
    if (step === 1 && user && addingProperty && newProperty.name) {
      if (!profile?.id) { toast.error("Your customer profile is still being linked. Please refresh and try again."); return; }
      const { data, error } = await supabase.from("customer_properties")
        .insert({ ...newProperty, user_id: user.id, client_id: profile.id }).select("*").single();
      if (error) { toast.error("Failed to save property"); return; }
      setProperties(p => [data, ...p]);
      setPropertyId(data.id);
      setAddingProperty(false);
    }
    setStep(s => Math.min(STEPS.length, s + 1));
  };

  const back = () => setStep(s => Math.max(1, s - 1));

  const submit = async () => {
    setSubmitting(true);
    try {
      const clientPhone = user ? (profile?.phone || guestInfo.phone) : guestInfo.phone;
      const clientName = user ? (profile?.full_name || guestInfo.name) : guestInfo.name;
      const clientAddr = currentProperty?.address || guestInfo.address;
      if (!clientName?.trim() || !clientPhone?.trim() || !clientAddr?.trim()) {
        throw new Error("Please provide your name, phone number and service location.");
      }
      const selectedAssets = propertyAssets
        .filter((asset: any) => selectedAssetIds.includes(asset.id))
        .map((asset: any) => ({ name: asset.name, room: asset.room || null, material: asset.material || null }));

      const requestPayload = {
        customer_type: user ? "registered" : "guest",
        name: clientName,
        phone: clientPhone,
        whatsapp_number: clientPhone,
        email: user?.email || null,
        location: clientAddr,
        property_type: currentProperty?.type || (user ? null : "Home"),
        property_name: currentProperty?.name || null,
        preferred_date: date ? format(date, "yyyy-MM-dd") : null,
        preferred_time: timeSlot,
        payment_preference: PAYMENT_METHODS.find(method => method.id === paymentMethod)?.label ?? paymentMethod,
        instructions: notes,
        selected_assets: selectedAssets,
        items: selectedServices.map(id => ({
          service_id: id,
          quantity: serviceQty[id] ?? 1,
        })),
      };
      const result = await submitERPServiceRequest({
        ...requestPayload,
        client_submission_id: getERPSubmissionId(requestPayload),
      });

      if (user) await supabase.from("customer_booking_drafts").delete().eq("user_id", user.id);
      clearERPSubmissionId();
      setConfirmed({ number: result.request_reference });
      setStep(7);
      toast.success("Your service request has been received.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message ?? "Failed to submit service request");
    } finally {
      setSubmitting(false);
    }
  };

  // Save draft (debounced) for logged-in users
  const saveDraft = useCallback(async () => {
    if (!user) return;
    const payload = {
      propertyId, selectedServices, serviceQty, selectedAssetIds, appliedRecs,
      date: date ? format(date, "yyyy-MM-dd") : null, timeSlot, paymentMethod, notes,
    };
    if (!profile?.id) return;
    await supabase.from("customer_booking_drafts").upsert(
      { user_id: user.id, client_id: profile.id, draft_payload: { step, ...payload } as any },
      { onConflict: "user_id" },
    );
  }, [user, propertyId, selectedServices, serviceQty, selectedAssetIds, appliedRecs, date, timeSlot, paymentMethod, notes, step, profile?.id]);

  useEffect(() => {
    if (!user || confirmed) return;
    const t = setTimeout(saveDraft, 800);
    return () => clearTimeout(t);
  }, [saveDraft, user, confirmed]);

  // Resume draft on load
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("customer_booking_drafts").select("*").eq("user_id", user.id).maybeSingle();
      if (data?.draft_payload) {
        const p: any = data.draft_payload;
        if (p.propertyId) setPropertyId(p.propertyId);
        if (p.selectedServices) setSelectedServices(p.selectedServices);
        if (p.serviceQty) setServiceQty(p.serviceQty);
        if (p.selectedAssetIds) setSelectedAssetIds(p.selectedAssetIds);
        if (p.appliedRecs) setAppliedRecs(p.appliedRecs);
        if (p.date) setDate(new Date(p.date));
        if (p.timeSlot) setTimeSlot(p.timeSlot);
        if (p.paymentMethod) setPaymentMethod(p.paymentMethod);
        if (p.notes) setNotes(p.notes);
      }
    })();
  }, [user]);

  // Confirmation screen
  if (confirmed) {
    const serviceSummary = serviceLines.map(line => `${line.name} × ${line.quantity}`).join(", ");
    const summaryText = `Hello Concept Cleaning Services,

I have submitted a booking request through your website and would like to confirm the details below:

Client Name: ${user ? (profile?.full_name || guestInfo.name) : guestInfo.name}
Phone: ${user ? (profile?.phone || guestInfo.phone) : guestInfo.phone}
Service: ${serviceSummary}
Preferred Date: ${date ? format(date, "PPP") : "To be confirmed"} · ${timeSlot}
Service Location: ${currentProperty?.address || guestInfo.address}
Amount: Estimated KES ${pricing.total.toLocaleString()} (subject to the official quotation)
Notes: ${notes || "None"}
Request Reference: ${confirmed.number}

Please confirm my booking request.

Concept Cleaning Services`;

    return (
      <div className="min-h-[80vh] bg-cream py-16 px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto">
          <div className="bg-card rounded-3xl border border-border p-8 sm:p-12 text-center shadow-lg">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring" }}
              className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </motion.div>
            <h1 className="font-display text-3xl font-bold text-primary mb-2">Request Received</h1>
            <p className="text-muted-foreground mb-6">Our team will review your services and prepare your official quotation.</p>

            <div className="bg-primary text-primary-foreground rounded-2xl p-6 mb-6">
              <p className="text-xs uppercase tracking-widest text-gold/80 mb-1">Request Reference</p>
              <p className="font-display text-3xl font-bold">{confirmed.number}</p>
            </div>

            <div className="text-left space-y-2 mb-6 text-sm">
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Services</span><span className="font-medium text-right">{serviceSummary}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Preferred date</span><span className="font-medium">{date && format(date, "PPP")} · {timeSlot}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Payment preference</span><span className="font-medium">{PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label}</span></div>
              <div className="flex justify-between border-t border-border pt-2 mt-2 text-base"><span className="font-semibold">Estimated amount</span><span className="font-bold text-primary">{formatKES(pricing.total)}</span></div>
              <p className="text-xs text-muted-foreground">This is an estimate only, not an approved quotation or confirmed booking.</p>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 mb-6 flex items-start gap-3 text-left">
              <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">What happens next?</p>
                <p className="text-muted-foreground text-xs">Our team will verify your request and contact you with the official quotation and confirmation.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="flex-1 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,40%)]">
                <a href={whatsappLink(summaryText)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-4 h-4 mr-2" /> Share on WhatsApp
                </a>
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => window.location.assign("/booking")}>
                Submit Another Request
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.24em] text-gold mb-2">Premium Concierge Booking</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-primary">
            {user ? `Welcome back, ${(profile?.full_name ?? "").split(" ")[0] || "Member"}` : "Book Your Service"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Complete in under a minute. We remember everything for next time.</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center flex-shrink-0">
                <button
                  onClick={() => s.id < step && setStep(s.id)}
                  disabled={s.id > step}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition",
                    s.id === step ? "bg-primary text-primary-foreground shadow-md"
                      : s.id < step ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px]",
                    s.id === step ? "bg-gold text-primary" : s.id < step ? "bg-emerald-600 text-white" : "bg-background")}>
                    {s.id < step ? <Check className="w-3 h-3" /> : s.id}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <div className={cn("w-3 h-px", s.id < step ? "bg-emerald-300" : "bg-border")} />}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Main panel */}
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 min-h-[400px]">
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>

                {/* STEP 1 - Property */}
                {step === 1 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="font-display text-2xl font-bold text-primary">Where should we clean?</h2>
                      <p className="text-sm text-muted-foreground">Pick a saved location or add a new one.</p>
                    </div>

                    {!user && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Input placeholder="Full name *" value={guestInfo.name} onChange={e => setGuestInfo({ ...guestInfo, name: e.target.value })} />
                          <Input placeholder="Phone *" value={guestInfo.phone} onChange={e => setGuestInfo({ ...guestInfo, phone: e.target.value })} />
                        </div>
                        <Input placeholder="Full address *" value={guestInfo.address} onChange={e => setGuestInfo({ ...guestInfo, address: e.target.value })} />
                        <div className="grid grid-cols-2 gap-3">
                          <Input placeholder="County" value={guestInfo.county} onChange={e => setGuestInfo({ ...guestInfo, county: e.target.value })} />
                          <Input placeholder="Estate" value={guestInfo.estate} onChange={e => setGuestInfo({ ...guestInfo, estate: e.target.value })} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Have an account? <button className="text-primary underline" onClick={() => navigate("/auth")}>Sign in</button> to save your properties & assets.
                        </p>
                      </div>
                    )}

                    {user && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {properties.map(p => {
                            const Icon = iconForProperty(p.type);
                            const active = propertyId === p.id;
                            return (
                              <button key={p.id} onClick={() => { setPropertyId(p.id); setAddingProperty(false); }}
                                className={cn(
                                  "text-left rounded-2xl border-2 p-4 transition group relative",
                                  active ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/40",
                                )}>
                                <div className="flex items-start gap-3">
                                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center",
                                    active ? "bg-primary text-primary-foreground" : "bg-muted text-primary")}>
                                    <Icon className="w-5 h-5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm">{p.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{p.address || `${p.type}`}</p>
                                  </div>
                                  {active && <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                                </div>
                              </button>
                            );
                          })}
                          <button onClick={() => setAddingProperty(true)}
                            className={cn(
                              "text-left rounded-2xl border-2 border-dashed p-4 transition flex items-center gap-3",
                              addingProperty ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 text-muted-foreground hover:text-primary",
                            )}>
                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center"><Plus className="w-5 h-5" /></div>
                            <div className="text-sm font-medium">Add new property</div>
                          </button>
                        </div>

                        {addingProperty && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                            className="mt-4 space-y-3 p-4 rounded-2xl bg-muted/40 border border-border">
                            <div className="grid grid-cols-2 gap-3">
                              <Input placeholder="Property name *" value={newProperty.name} onChange={e => setNewProperty({ ...newProperty, name: e.target.value })} />
                              <Select value={newProperty.type} onValueChange={v => setNewProperty({ ...newProperty, type: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <Input placeholder="Full address" value={newProperty.address} onChange={e => setNewProperty({ ...newProperty, address: e.target.value })} />
                            <div className="grid grid-cols-2 gap-3">
                              <Input placeholder="County" value={newProperty.county} onChange={e => setNewProperty({ ...newProperty, county: e.target.value })} />
                              <Input placeholder="Estate" value={newProperty.estate} onChange={e => setNewProperty({ ...newProperty, estate: e.target.value })} />
                            </div>
                          </motion.div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* STEP 2 - Services */}
                {step === 2 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="font-display text-2xl font-bold text-primary">What can we clean?</h2>
                      <p className="text-sm text-muted-foreground">Select one or more premium services.</p>
                    </div>
                    {loadingCatalog ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {services.map(s => {
                          const active = selectedServices.includes(s.id);
                          return (
                            <button key={s.id} onClick={() => toggleService(s.id)}
                              className={cn(
                                "text-left rounded-2xl border-2 p-4 transition",
                                active ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/40",
                              )}>
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-sm">{s.name}</p>
                                  <p className="text-xs text-muted-foreground">From {formatKES(Number(s.price_value))}</p>
                                </div>
                                <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0",
                                  active ? "bg-primary border-primary" : "border-border")}>
                                  {active && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                                </div>
                              </div>
                              {active && (
                                <div className="mt-3 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                  <span className="text-xs text-muted-foreground">Qty</span>
                                  <div className="flex items-center gap-1.5 bg-background rounded-full border border-border">
                                    <button className="w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center text-sm"
                                      onClick={() => setServiceQty(q => ({ ...q, [s.id]: Math.max(1, (q[s.id] ?? 1) - 1) }))}>−</button>
                                    <span className="text-xs font-semibold w-4 text-center">{serviceQty[s.id] ?? 1}</span>
                                    <button className="w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center text-sm"
                                      onClick={() => setServiceQty(q => ({ ...q, [s.id]: (q[s.id] ?? 1) + 1 }))}>+</button>
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3 - Assets */}
                {step === 3 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="font-display text-2xl font-bold text-primary">Which items?</h2>
                      <p className="text-sm text-muted-foreground">
                        {user ? "Tick anything we should clean at this property." : "Sign in to save your assets for one-tap bookings."}
                      </p>
                    </div>
                    {!user ? (
                      <div className="text-center py-10 rounded-2xl bg-muted/40 text-sm text-muted-foreground">
                        Skip this step — we'll note items during your first visit.
                      </div>
                    ) : propertyAssets.length === 0 ? (
                      <div className="text-center py-10 rounded-2xl bg-muted/40">
                        <Sofa className="w-8 h-8 mx-auto text-muted-foreground/60 mb-2" />
                        <p className="text-sm text-muted-foreground mb-3">No saved assets for this property yet.</p>
                        <Button variant="outline" size="sm" onClick={() => navigate("/portal/assets")}>Add assets</Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {["Living Room", "Bedroom", "Kitchen", "Bathroom", "Vehicle", "Office", "Other"].map(room => {
                          const items = propertyAssets.filter(a => (a.room ?? "Other") === room);
                          if (items.length === 0) return null;
                          return (
                            <div key={room}>
                              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{room}</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {items.map(a => {
                                  const active = selectedAssetIds.includes(a.id);
                                  return (
                                    <button key={a.id} onClick={() => toggleAsset(a.id)}
                                      className={cn(
                                        "flex items-center gap-3 p-3 rounded-xl border transition text-left",
                                        active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                                      )}>
                                      <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center shrink-0",
                                        active ? "bg-primary border-primary" : "border-border")}>
                                        {active && <Check className="w-3 h-3 text-primary-foreground" />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{a.name}</p>
                                        {(a.size || a.material) && <p className="text-[11px] text-muted-foreground truncate">{[a.size, a.material].filter(Boolean).join(" · ")}</p>}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 4 - Recommendations */}
                {step === 4 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="font-display text-2xl font-bold text-primary">Smart Suggestions</h2>
                      <p className="text-sm text-muted-foreground">Curated for your property and history.</p>
                    </div>
                    {recommendations.length === 0 ? (
                      <div className="text-center py-10 rounded-2xl bg-emerald-50 border border-emerald-100">
                        <Sparkles className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
                        <p className="text-sm text-emerald-800 font-medium">You're all set — no additional recommendations right now.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {recommendations.map(rec => {
                          const applied = appliedRecs.includes(rec.id);
                          return (
                            <div key={rec.id} className={cn(
                              "rounded-2xl border p-4 flex items-start gap-4",
                              applied ? "border-emerald-300 bg-emerald-50" : "border-gold/40 bg-gold/5",
                            )}>
                              <div className="w-10 h-10 rounded-xl bg-gold/20 text-primary flex items-center justify-center shrink-0">
                                <Sparkles className="w-5 h-5" />
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-sm">{rec.title}</p>
                                <p className="text-xs text-muted-foreground">{rec.reason}</p>
                                {rec.discount && <p className="text-xs text-emerald-700 font-medium mt-1">Save {rec.discount}%</p>}
                              </div>
                              <Button size="sm" variant={applied ? "outline" : "default"} onClick={() => applyRec(rec)} disabled={applied}>
                                {applied ? <><Check className="w-3.5 h-3.5 mr-1" /> Added</> : "Add"}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 5 - Date/Time */}
                {step === 5 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="font-display text-2xl font-bold text-primary">When?</h2>
                      <p className="text-sm text-muted-foreground">Choose a date and preferred slot.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-xs font-medium mb-2 block uppercase tracking-widest text-muted-foreground">Date</label>
                        <div className="rounded-2xl border border-border p-2 bg-background inline-block">
                          <Calendar mode="single" selected={date} onSelect={setDate}
                            disabled={d => d < new Date(new Date().setHours(0,0,0,0))}
                            className="pointer-events-auto" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-2 block uppercase tracking-widest text-muted-foreground">Time slot</label>
                        <div className="space-y-3">
                          {["Morning", "Afternoon", "Evening", "Emergency"].map(group => (
                            <div key={group}>
                              <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">{group}</p>
                              <div className="grid grid-cols-2 gap-2">
                                {TIME_SLOTS.filter(t => t.group === group).map(t => (
                                  <button key={t.value} onClick={() => setTimeSlot(t.value)}
                                    className={cn(
                                      "px-3 py-2 rounded-xl border text-sm transition",
                                      timeSlot === t.value ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border hover:border-primary/40",
                                    )}>
                                    {t.value}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        {date && timeSlot && (
                          <div className="mt-4 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" />
                            Estimated arrival: {timeSlot} on {format(date, "EEE, MMM d")}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-2 block uppercase tracking-widest text-muted-foreground">Special instructions</label>
                      <Textarea rows={3} placeholder="Any preferences, access notes, or extras…" value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>
                  </div>
                )}

                {/* STEP 6 - Payment */}
                {step === 6 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="font-display text-2xl font-bold text-primary">Payment method</h2>
                      <p className="text-sm text-muted-foreground">No charge now — you confirm before we bill.</p>
                    </div>
                    <div className="space-y-2">
                      {PAYMENT_METHODS.map(m => {
                        const Icon = m.icon;
                        const active = paymentMethod === m.id;
                        return (
                          <button key={m.id} onClick={() => setPaymentMethod(m.id)}
                            className={cn(
                              "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition text-left",
                              active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                            )}>
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center",
                              active ? "bg-primary text-primary-foreground" : "bg-muted text-primary")}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-sm">{m.label}</p>
                              <p className="text-xs text-muted-foreground">{m.desc}</p>
                            </div>
                            <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center",
                              active ? "bg-primary border-primary" : "border-border")}>
                              {active && <Check className="w-3 h-3 text-primary-foreground" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* STEP 7 - Review */}
                {step === 7 && !confirmed && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="font-display text-2xl font-bold text-primary">Review & Confirm</h2>
                      <p className="text-sm text-muted-foreground">Everything looks right? Let's go.</p>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="rounded-xl border border-border p-4">
                        <p className="text-xs uppercase text-muted-foreground mb-1">Property</p>
                        <p className="font-medium">{currentProperty?.name ?? guestInfo.name}</p>
                        <p className="text-xs text-muted-foreground">{currentProperty?.address ?? guestInfo.address}</p>
                      </div>
                      <div className="rounded-xl border border-border p-4">
                        <p className="text-xs uppercase text-muted-foreground mb-1">Services</p>
                        {serviceLines.map(s => (
                          <div key={s.name} className="flex justify-between"><span>{s.name} × {s.quantity}</span><span>{formatKES(s.unitPrice * s.quantity)}</span></div>
                        ))}
                      </div>
                      {selectedAssetIds.length > 0 && (
                        <div className="rounded-xl border border-border p-4">
                          <p className="text-xs uppercase text-muted-foreground mb-1">Items ({selectedAssetIds.length})</p>
                          <p className="text-xs">{propertyAssets.filter(a => selectedAssetIds.includes(a.id)).map(a => a.name).join(", ")}</p>
                        </div>
                      )}
                      <div className="rounded-xl border border-border p-4">
                        <p className="text-xs uppercase text-muted-foreground mb-1">When</p>
                        <p className="font-medium">{date && format(date, "PPP")} · {timeSlot}</p>
                      </div>
                      <div className="rounded-xl border border-border p-4">
                        <p className="text-xs uppercase text-muted-foreground mb-1">Payment</p>
                        <p className="font-medium">{PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label}</p>
                      </div>
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="mt-8 flex items-center justify-between pt-5 border-t border-border">
              <Button variant="ghost" onClick={back} disabled={step === 1}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              {step < 7 ? (
                <Button onClick={next} disabled={!canProceed()} className="min-w-[140px]">
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={submit} disabled={submitting} className="min-w-[180px] bg-gold text-primary hover:bg-gold/90">
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming…</> : <>Confirm Booking <Check className="w-4 h-4 ml-2" /></>}
                </Button>
              )}
            </div>
          </div>

          {/* Price sidebar */}
          <div className="lg:sticky lg:top-24 lg:h-fit">
            <div className="bg-primary text-primary-foreground rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-gold" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-gold/80">Live Estimate</p>
                  <p className="text-[10px] text-primary-foreground/60">Transparent · no hidden fees</p>
                </div>
              </div>

              {serviceLines.length === 0 ? (
                <div className="py-8 text-center text-primary-foreground/60 text-sm">Select services to see pricing.</div>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    {serviceLines.map(l => (
                      <div key={l.name} className="flex justify-between text-sm">
                        <span className="text-primary-foreground/80">{l.name} × {l.quantity}</span>
                        <span>{formatKES(l.unitPrice * l.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-white/10 pt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between text-primary-foreground/70"><span>Subtotal</span><span>{formatKES(pricing.subtotal)}</span></div>
                    {membershipPct > 0 && (
                      <div className="flex justify-between text-emerald-300"><span>{profile?.membership_tier} member −{membershipPct}%</span><span>−{formatKES(pricing.membershipDiscount)}</span></div>
                    )}
                    {bundlePct > 0 && (
                      <div className="flex justify-between text-emerald-300"><span>Bundle discount −{bundlePct}%</span><span>−{formatKES(pricing.bundleDiscount)}</span></div>
                    )}
                    <div className="flex justify-between text-primary-foreground/70"><span>Transport</span><span>{formatKES(pricing.transport)}</span></div>
                  </div>
                  <div className="border-t border-white/10 pt-3 mt-3">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs uppercase tracking-widest text-gold/80">Total</span>
                      <span className="font-display text-3xl font-bold text-gold">{formatKES(pricing.total)}</span>
                    </div>
                    {pricing.estimatedDurationMinutes > 0 && (
                      <p className="text-[11px] text-primary-foreground/60 mt-1">≈ {Math.round(pricing.estimatedDurationMinutes / 60 * 10) / 10} hours</p>
                    )}
                  </div>
                </>
              )}

              {user && (
                <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-primary-foreground/60">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  Draft auto-saved
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Booking;
