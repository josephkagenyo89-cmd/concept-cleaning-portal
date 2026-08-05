import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Sparkles } from 'lucide-react';

function safeNext(next: string | null) {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

export default function CustomerAuth() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [login, setLogin] = useState({ email: '', password: '' });
  const [reg, setReg] = useState({ full_name: '', email: '', phone: '', location: '', password: '' });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: login.email, password: login.password });
    setLoading(false);
    if (error) {
      toast({ title: 'Login failed', description: error.message, variant: 'destructive' });
      return;
    }
    navigate(next, { replace: true });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: reg.email,
      password: reg.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          account_type: 'customer',
          full_name: reg.full_name,
          phone: reg.phone,
          location: reg.location,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: 'Registration failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Account created', description: 'Check your email to verify, then sign in.' });
  };

  return (
    <div className="p-4">
      <Card className="mx-auto max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-market">
            <Sparkles className="h-6 w-6 text-market-foreground" />
          </div>
          <CardTitle className="text-xl">Customer account</CardTitle>
          <CardDescription>Book services and track your history</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="l_email">Email</Label>
                  <Input id="l_email" type="email" required value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="l_pass">Password</Label>
                  <Input id="l_pass" type="password" required value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-market text-market-foreground hover:bg-market/90">
                  {loading ? 'Signing in…' : 'Sign In'}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  <Link to="/forgot-password" className="font-medium text-market hover:underline">Forgot password?</Link>
                </p>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="r_name">Full name</Label>
                  <Input id="r_name" required value={reg.full_name} onChange={(e) => setReg({ ...reg, full_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r_email">Email</Label>
                  <Input id="r_email" type="email" required value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r_phone">Phone</Label>
                  <Input id="r_phone" required value={reg.phone} onChange={(e) => setReg({ ...reg, phone: e.target.value })} placeholder="07xx xxx xxx" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r_loc">Location</Label>
                  <Input id="r_loc" value={reg.location} onChange={(e) => setReg({ ...reg, location: e.target.value })} placeholder="Estate, town" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r_pass">Password</Label>
                  <Input id="r_pass" type="password" required minLength={6} value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} />
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
