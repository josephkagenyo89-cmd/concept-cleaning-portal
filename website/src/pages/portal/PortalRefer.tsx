import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

const PortalRefer = () => {
  const { profile } = useAuth();
  const code = profile?.referral_code ?? "—";
  const link = `${window.location.origin}/auth?mode=signup&ref=${code}`;

  const copy = async (v: string) => {
    await navigator.clipboard.writeText(v);
    toast.success("Copied!");
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-primary">Refer & Earn</h1>
      <p className="text-sm text-muted-foreground max-w-lg">
        Share your referral code with friends. Referrals are recorded against your account, and any eligible rewards are confirmed by the Concept Cleaning team.
      </p>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Your Referral Code</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-lg font-bold text-primary bg-cream rounded-xl px-4 py-3">{code}</code>
            <Button variant="outline" size="icon" onClick={() => copy(code)}><Copy className="w-4 h-4" /></Button>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Share Link</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs truncate bg-cream rounded-xl px-4 py-3">{link}</code>
            <Button variant="outline" size="icon" onClick={() => copy(link)}><Copy className="w-4 h-4" /></Button>
            <Button size="icon" onClick={() => {
              if (navigator.share) navigator.share({ title: "Concept Cleaning", text: `Use my code ${code}`, url: link });
              else copy(link);
            }}><Share2 className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortalRefer;
