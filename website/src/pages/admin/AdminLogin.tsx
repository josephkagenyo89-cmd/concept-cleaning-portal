import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Lock } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder — will be replaced with Lovable Cloud auth
    if (email && password) {
      localStorage.setItem("admin_logged_in", "true");
      toast.success("Welcome back!");
      navigate("/admin");
    } else {
      toast.error("Please enter credentials");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-foreground p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-background">Admin Login</h1>
          <p className="text-background/50 text-sm mt-1">Concept Cleaning Services</p>
        </div>

        <form onSubmit={handleLogin} className="bg-card rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Email</label>
            <Input type="email" placeholder="admin@concept.co.ke" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Password</label>
            <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" size="lg">
            <Lock className="w-4 h-4 mr-2" /> Sign In
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
