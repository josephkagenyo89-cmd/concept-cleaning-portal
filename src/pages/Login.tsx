import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff, Sparkles, AlertCircle } from 'lucide-react';
import { rateLimiter, RATE_LIMIT_CONFIG } from '@/lib/rateLimiter';

function safeNext(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith('/') || next.startsWith('//')) return null;
  return next;
}

const lockMessage = (seconds: number) => {
  if (seconds >= 60) {
    const m = Math.ceil(seconds / 60);
    return `Too many login attempts. Please try again in ${m} minute${m > 1 ? 's' : ''}.`;
  }
  return `Too many login attempts. Please try again in ${seconds} seconds.`;
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lockSeconds, setLockSeconds] = useState(0);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const { user, loading, isAdmin, isAgent } = useAuth();
  const config = RATE_LIMIT_CONFIG.LOGIN;
  const locked = lockSeconds > 0;

  // On mount: look only, do not count an attempt
  useEffect(() => {
    const status = rateLimiter.peek(config.key, config.maxAttempts, config.windowMs);
    if (!status.allowed) setLockSeconds(status.secondsRemaining);
  }, []);

  // Countdown while locked
  useEffect(() => {
    if (lockSeconds <= 0) return;
    const t = setTimeout(() => setLockSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [lockSeconds]);

  // Redirect once logged in
  useEffect(() => {
    if (loading || !user) return;
    if (next) {
      navigate(next, { replace: true });
    } else if (isAdmin) {
      navigate('/admin', { replace: true });
    } else if (isAgent) {
      navigate('/agent', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [user, loading, isAdmin, isAgent, next, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation first: never costs an attempt
    if (!email || !password) {
      toast({
        title: 'Missing credentials',
        description: 'Please enter both email and password',
        variant: 'destructive',
      });
      return;
    }

    // Look only
    const status = rateLimiter.peek(config.key, config.maxAttempts, config.windowMs);
    if (!status.allowed) {
      setLockSeconds(status.secondsRemaining);
      toast({
        title: 'Login temporarily locked',
        description: lockMessage(status.secondsRemaining),
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setSubmitting(false);
      // Only failed logins count
      const after = rateLimiter.hit(config.key, config.maxAttempts, config.windowMs);
      if (!after.allowed) setLockSeconds(after.secondsRemaining);
      toast({
        title: 'Login failed',
        description: after.allowed
          ? `${error.message} (${after.remaining} attempts remaining)`
          : error.message,
        variant: 'destructive',
      });
      return;
    }

    rateLimiter.clear(config.key);
    toast({ title: 'Login successful', description: 'Redirecting...' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">Login</CardTitle>
          <CardDescription className="text-center">
            Access your Concept Cleaning account
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {locked && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">{lockMessage(lockSeconds)}</p>
                  <p className="text-xs text-red-600 mt-1">
                    Too many failed attempts. Please wait before trying again.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting || locked}
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting || locked}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={submitting || locked}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting || locked}>
              {submitting ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3">
          <p className="text-sm text-muted-foreground text-center">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
