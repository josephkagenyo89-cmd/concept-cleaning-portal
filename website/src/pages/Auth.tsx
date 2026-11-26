import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Mail, Lock, User, Phone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PageHead from "@/components/PageHead";

const AUTH_RETURN_KEY = "concept-auth-return-to";

const safeReturnPath = (path: string | null) =>
  path?.startsWith("/") && !path.startsWith("//") ? path : null;

const Auth = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(params.get("mode") === "signup" ? "signup" : "login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "" });

  useEffect(() => {
    if (!user) return;
    const returnPath = safeReturnPath(sessionStorage.getItem(AUTH_RETURN_KEY))
      ?? safeReturnPath(params.get("next"))
      ?? "/portal";
    sessionStorage.removeItem(AUTH_RETURN_KEY);
    navigate(returnPath, { replace: true });
  }, [user, navigate, params]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            emailRedirectTo: `${window.location.origin}/portal`,
            data: { full_name: form.full_name, phone: form.phone, referral_code: params.get("ref") || null },
          },
        });
        if (error) throw error;
        toast.success("Welcome to the Concept Cleaning family!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) throw error;
        toast.success("Welcome back");
      }
      navigate("/portal", { replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    const returnPath = safeReturnPath(params.get("next")) ?? "/portal";
    sessionStorage.setItem(AUTH_RETURN_KEY, returnPath);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth` } });
    const res = { error };
    if (res.error) {
      toast.error("Google sign-in failed");
      sessionStorage.removeItem(AUTH_RETURN_KEY);
      setLoading(false);
    }
  };

  return (
    <>
      <PageHead title={mode === "signup" ? "Join the Family — Concept Cleaning" : "Sign In — Concept Cleaning"} description="Secure customer portal for Concept Cleaning Services clients." />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-cream to-background px-4 py-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2.5 mb-6">
              <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-gold" />
              </div>
              <div className="text-left leading-none">
                <p className="font-display font-bold text-primary">Concept</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Cleaning Co.</p>
              </div>
            </Link>
            <h1 className="font-display text-3xl font-bold text-primary">
              {mode === "signup" ? "Join the Family" : "Welcome Back"}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {mode === "signup" ? "Create your premium member account" : "Sign in to your member portal"}
            </p>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-card">
            <Button variant="outline" className="w-full mb-4 rounded-full" onClick={google} disabled={loading}>
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.24 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/></svg>
              {mode === "signup" ? "Sign up with Google" : "Sign in with Google"}
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs uppercase tracking-widest"><span className="bg-card px-2 text-muted-foreground">or</span></div>
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input className="pl-10 rounded-full h-11" placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input className="pl-10 rounded-full h-11" placeholder="Phone (+254...)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                  </div>
                </>
              )}
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="email" className="pl-10 rounded-full h-11" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="password" className="pl-10 rounded-full h-11" placeholder="Password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {mode === "signup" ? "Create account" : "Sign in"} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-5">
              {mode === "signup" ? "Already have an account? " : "New to Concept? "}
              <button onClick={() => setMode(mode === "signup" ? "login" : "signup")} className="text-primary font-medium hover:text-terracotta">
                {mode === "signup" ? "Sign in" : "Join the Family"}
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default Auth;
