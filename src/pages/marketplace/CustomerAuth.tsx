import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Sparkles } from 'lucide-react';
import { friendlyAuthError, isValidPhone, localPhone } from '@/lib/customerAuth';

function safeNext(next: string | null) {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/my';
  return next;
}

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export default function CustomerAuth() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const { isCustomer } = useAuth();
  const [loading, setLoading] = useState(false);
  const [login, setLogin] = useState({ email: '', password: '' });
  const [reg, setReg] = useState({
    full_name: '',
    email: '',
    phone: '',
    whatsapp_number: '',
    location: '',
    notes: '',
    password: '',
    confirm: '',
  });

  // Authenticated customers never see login/registration prompts.
  useEffect(() => {
    if (isCustomer) navigate(next, { replace: true });
  }, [isCustomer, next, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(login.email)) {
      toast({ title: 'Invalid email', description: 'Enter the email you registered with.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: login.email.trim().toLowerCase(),
      password: login.password,
    });
    setLoading(false);
    if (error) {
      toast({ title: 'Login failed', description: friendlyAuthError(error.message), variant: 'destructive' });
      return;
    }
    toast({ title: 'Welcome back' });
    navigate(next, { replace: true });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = reg.full_name.trim();
    if (!name) {
      toast({ title: 'Full name required', variant: 'destructive' });
      return;
    }
    if (!isValidEmail(reg.email)) {
      toast({ title: 'Valid email required', description: 'Your email is your login.', variant: 'destructive' });
      return;
    }
    if (!isValidPhone(reg.phone)) {
      toast({ title: 'Invalid phone number', description: 'Use a valid number, e.g. 0712345678.', variant: 'destructive' });
      return;
    }
    if (reg.password.length < 6) {
      toast({ title: 'Password too short', description: 'Use at least 6 characters.', variant: 'destructive' });
      return;
    }
    if (reg.password !== reg.confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    const email = reg.email.trim().toLowerCase();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: reg.password,
      options: {
        data: {
          account_type: 'customer',
          full_name: name,
          email,
          phone: localPhone(reg.phone),
          whatsapp_number: reg.whatsapp_number.trim() ? localPhone(reg.whatsapp_number) : localPhone(reg.phone),
          location: reg.location.trim(),
          notes: reg.notes.trim(),
        },
      },
    });

    if (error) {
      setLoading(false);
      toast({ title: 'Registration failed', description: friendlyAuthError(error.message), variant: 'destructive' });
      return;
    }

    // Auto sign-in when the signup did not already return a session.
    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: reg.password });
      if (signInError) {
        setLoading(false);
        toast({ title: 'Account created', description: 'Please sign in with your email and password.' });
        return;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await pushNotification({
        user_id: user.id,
        type: 'account',
        title: 'Account created successfully',
        body: `Welcome ${name}! Your customer account is ready. You can now book services and track everything here.`,
        link: '/my',
      });
    }

    setLoading(false);
    toast({ title: 'Account created', description: 'Your customer profile is ready.' });
    navigate('/my', { replace: true });
  };

  return (
    <div className="p-4">
      <Card className="mx-auto max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-market">
            <Sparkles className="h-6 w-6 text-market-foreground" />
          </div>
          <CardTitle className="text-xl">Customer account</CardTitle>
          <CardDescription>Book services and track your history — no email verification needed</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={params.get('tab') === 'register' ? 'register' : 'login'}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="l_email">Email</Label>
                  <Input id="l_email" type="email" required placeholder="you@example.com"
                    value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="l_pass">Password</Label>
                  <Input id="l_pass" type="password" required value={login.password}
                    onChange={(e) => setLogin({ ...login, password: e.target.value })} />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-market text-market-foreground hover:bg-market/90">
                  {loading ? 'Signing in…' : 'Sign In'}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Forgot your password? Contact our team from the{' '}
                  <Link to="/my/support" className="font-medium text-market hover:underline">support page</Link>.
                </p>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="r_name">Full name *</Label>
                  <Input id="r_name" required placeholder="Jane Wanjiku"
                    value={reg.full_name} onChange={(e) => setReg({ ...reg, full_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r_email">Email *</Label>
                  <Input id="r_email" type="email" required placeholder="you@example.com"
                    value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} />
                  <p className="text-[10px] text-muted-foreground">This is your login. No verification email is sent.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r_phone">Phone number *</Label>
                  <Input id="r_phone" inputMode="tel" required placeholder="0712345678"
                    value={reg.phone} onChange={(e) => setReg({ ...reg, phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r_wa">WhatsApp number</Label>
                  <Input id="r_wa" inputMode="tel" placeholder="Same as phone if blank"
                    value={reg.whatsapp_number} onChange={(e) => setReg({ ...reg, whatsapp_number: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r_loc">Location</Label>
                  <Input id="r_loc" placeholder="Kilimani, Nairobi"
                    value={reg.location} onChange={(e) => setReg({ ...reg, location: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r_notes">Notes</Label>
                  <Textarea id="r_notes" rows={2} placeholder="Anything we should know (optional)"
                    value={reg.notes} onChange={(e) => setReg({ ...reg, notes: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r_pass">Password *</Label>
                  <Input id="r_pass" type="password" required minLength={6}
                    value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r_conf">Confirm password *</Label>
                  <Input id="r_conf" type="password" required minLength={6}
                    value={reg.confirm} onChange={(e) => setReg({ ...reg, confirm: e.target.value })} />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-market text-market-foreground hover:bg-market/90">
                  {loading ? 'Creating account…' : 'Create Customer Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Staff member? <Link to="/login" className="font-medium text-primary hover:underline">Use the staff portal</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
