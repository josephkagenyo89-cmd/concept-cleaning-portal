import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff, Sparkles, AlertCircle } from 'lucide-react';
import { rateLimiter, RATE_LIMIT_CONFIG } from '@/lib/rateLimiter';

const lockMessage = (seconds: number) => {
  const m = Math.max(1, Math.ceil(seconds / 60));
  return `Too many signup attempts. Please try again in ${m} minute${m > 1 ? 's' : ''}.`;
};

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lockSeconds, setLockSeconds] = useState(0);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const config = RATE_LIMIT_CONFIG.SIGNUP;
  const locked = lockSeconds > 0;

  useEffect(() => {
    if (loading || !user) return;
    navigate('/', { replace: true });
  }, [user, loading, navigate]);

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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation first: never costs an attempt
    if (!email || !password || !confirmPassword || !fullName) {
      toast({ title: 'Missing fields', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Password mismatch', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (password.length < 8) {
      toast({ title: 'Weak password', description: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }

    // Look only
    const status = rateLimiter.peek(config.key, config.maxAttempts, config.windowMs);
    if (!status.allowed) {
      setLockSeconds(status.secondsRemaining);
      toast({
        title: 'Signup temporarily locked',
        description: lockMessage(status.secondsRemaining),
        variant: 'destructive',
      });
      return;
    }

    // Count this real attempt
    const after = rateLimiter.hit(config.key, config.maxAttempts, config.windowMs);
    if (!after.allowed) setLockSeconds(after.secondsRemaining);

    setSubmitting(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (error) {
        setSubmitting(false);
        toast({ title: 'Signup failed', description: error.message, variant: 'destructive' });
        return;
      }

      rateLimiter.clear(config.key);
      toast({
        title: 'Signup successful',
        description: 'Please check your email to confirm your account',
      });
      navigate('/customer-auth', { replace: true });
    } catch {
      setSubmitting(false);
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">Create Account</CardTitle>
          <CardDescription className="text-center">Join Concept Cleaning Services</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            {locked && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-red-800">{lockMessage(lockSeconds)}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Kamau"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={submitting || locked}
                required
              />
            </div>

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
              <Label htmlFor="password">Password</Label>
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
              <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={submitting || locked}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting || locked}>
              {submitting ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3">
          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{' '}
            <Link to="/customer-auth" className="text-primary hover:underline font-medium">
              Login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
