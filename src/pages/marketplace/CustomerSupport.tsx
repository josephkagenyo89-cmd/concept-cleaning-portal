import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Phone, Mail, Globe, MapPin, ArrowLeft, Star } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/contexts/AuthContext';

export default function CustomerSupport() {
  const { settings } = useSettings();
  const { customerClient } = useAuth();
  const g = settings.general;
  const waNumber = (g.phone || '').replace(/\D/g, '');
  const waText = encodeURIComponent(
    `Hello ${g.company_name || 'Concept Cleaning Services'}, this is ${customerClient?.full_name || 'a customer'}${
      customerClient?.client_code ? ` (${customerClient.client_code})` : ''
    }. I need help with:`
  );

  return (
    <div className="space-y-4 p-4">
      <Link to="/my" className="inline-flex items-center gap-1 text-xs font-medium text-market">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>

      <div>
        <h1 className="text-base font-bold">Customer support</h1>
        <p className="text-xs text-muted-foreground">Our team replies during working hours.</p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Contact us</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {waNumber && (
            <Button asChild className="w-full bg-market text-market-foreground hover:bg-market/90">
              <a href={`https://wa.me/${waNumber}?text=${waText}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" /> Chat on WhatsApp
              </a>
            </Button>
          )}
          {g.phone && (
            <Button asChild variant="outline" className="w-full">
              <a href={`tel:${g.phone}`}><Phone className="mr-2 h-4 w-4" /> Call {g.phone}</a>
            </Button>
          )}
          {g.email && (
            <Button asChild variant="outline" className="w-full">
              <a href={`mailto:${g.email}`}><Mail className="mr-2 h-4 w-4" /> Email {g.email}</a>
            </Button>
          )}
          {g.website && (
            <Button asChild variant="outline" className="w-full">
              <a href={g.website} target="_blank" rel="noopener noreferrer">
                <Globe className="mr-2 h-4 w-4" /> Visit our website
              </a>
            </Button>
          )}
          {g.address && (
            <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {g.address}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Rate a completed service</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Open a completed booking to leave your rating and comments.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link to="/my/bookings"><Star className="mr-2 h-4 w-4" /> Go to my bookings</Link>
          </Button>
          {settings.integrations.google_review_url && (
            <Button asChild variant="outline" className="w-full">
              <a href={settings.integrations.google_review_url} target="_blank" rel="noopener noreferrer">
                Leave a Google review
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
