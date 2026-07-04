import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, ShieldCheck } from "lucide-react";

// Minimal typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};
const oauth = (supabase.auth as any).oauth as OAuthApi;

function isSafeRelative(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id in URL.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        if (isSafeRelative(next)) {
          window.location.href = "/login?next=" + encodeURIComponent(next);
        } else {
          window.location.href = "/login";
        }
        return;
      }
      if (!oauth?.getAuthorizationDetails) {
        setError("This build of the auth client does not support the OAuth consent API.");
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Authorize Connection</CardTitle>
          <CardDescription>
            {details?.client?.name
              ? `${details.client.name} wants to connect to Concept Cleaning Services.`
              : "Review this connection request."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 text-destructive text-sm p-3">{error}</div>
          )}
          {!error && !details && (
            <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
              <div className="h-6 w-6 rounded-full border-4 border-muted border-t-primary animate-spin mr-2" />
              Loading authorization…
            </div>
          )}
          {details && (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Approving will let this client access the system on your behalf. It will use your
                permissions and role. You can revoke access at any time from your account.
              </p>
              {Array.isArray(details.scopes) && details.scopes.length > 0 && (
                <div>
                  <p className="font-medium mb-1">Requested scopes:</p>
                  <ul className="list-disc list-inside text-muted-foreground">
                    {details.scopes.map((s: string) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button
            className="w-full"
            disabled={busy || !details}
            onClick={() => decide(true)}
          >
            {busy ? "Processing…" : "Approve"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={busy || !details}
            onClick={() => decide(false)}
          >
            Deny
          </Button>
          <p className="text-xs text-muted-foreground text-center pt-2 flex items-center justify-center gap-1">
            <Sparkles className="h-3 w-3" />
            Concept Cleaning Services
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
