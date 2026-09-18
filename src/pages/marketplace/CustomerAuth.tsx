import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Chrome, Sparkles } from 'lucide-react';
import { friendlyAuthError } from '@/lib/customerAuth';
import CustomerLoginMascot from '@/components/marketplace/CustomerLoginMascot';

function safeNext(next: string | null) {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return '/my';
  }

  return next;
}

export default function CustomerAuth() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const { isCustomer } = useAuth();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isCustomer) {
      navigate(next, { replace: true });
    }
  }, [isCustomer, next, navigate]);

  const handleGoogleSignIn = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/my/account`,
      },
    });

    if (error) {
      setLoading(false);

      toast({
        title: 'Google sign-in failed',
        description: friendlyAuthError(error.message),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 md:p-8">
      <Card className="mx-auto w-full max-w-md overflow-hidden">
        <CardHeader className="text-center">
          <CustomerLoginMascot />

          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-market">
            <Sparkles className="h-7 w-7 text-market-foreground" />
          </div>

          <CardTitle className="text-2xl">
            Customer account
          </CardTitle>

          <CardDescription className="mx-auto max-w-sm">
            Sign in or create your customer account with Google to book
            cleaning services and track your bookings.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full text-base transition-all duration-300 hover:scale-[1.02] hover:shadow-md"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <Chrome className="mr-3 h-5 w-5" />

            {loading
              ? 'Connecting to Google…'
              : 'Continue with Google'}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            New customers and returning customers use the same Google
            sign-in.
          </p>

          <p className="pt-2 text-center text-xs text-muted-foreground">
            Staff member?{' '}
            <Link
              to="/login"
              className="font-medium text-primary hover:underline"
            >
              Use the staff portal
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}