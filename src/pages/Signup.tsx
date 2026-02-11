import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Sparkles } from 'lucide-react';

export default function Signup() {
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', town_estate: '', mpesa_number: '', password: '', referral_code: '',
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const update = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: form.full_name,
          phone: form.phone,
          town_estate: form.town_estate,
          mpesa_number: form.mpesa_number,
          referral_code: form.referral_code || null,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: 'Signup failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Account created!', description: 'Please check your email to verify your account.' });
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Agent Sign Up</CardTitle>
          <CardDescription>Join CleanBook Nairobi as an agent</CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" value={form.full_name} onChange={update('full_name')} required placeholder="John Doe" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={update('email')} required placeholder="you@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" value={form.phone} onChange={update('phone')} required placeholder="0712345678" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mpesa_number">M-Pesa Number</Label>
              <Input id="mpesa_number" value={form.mpesa_number} onChange={update('mpesa_number')} required placeholder="0712345678" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="town_estate">Town / Estate</Label>
              <Input id="town_estate" value={form.town_estate} onChange={update('town_estate')} required placeholder="Westlands, Nairobi" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={form.password} onChange={update('password')} required minLength={6} placeholder="••••••••" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="referral_code">Referral Code (optional)</Label>
              <Input id="referral_code" value={form.referral_code} onChange={update('referral_code')} placeholder="ABC123" />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Agent Account'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
