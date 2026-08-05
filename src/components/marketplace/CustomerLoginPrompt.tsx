import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LockKeyhole } from 'lucide-react';

export default function CustomerLoginPrompt({ title }: { title: string }) {
  const location = useLocation();
  return (
    <div className="p-4">
      <h1 className="text-base font-bold">{title}</h1>
      <Card className="mt-4">
        <CardContent className="space-y-3 p-6 text-center">
          <LockKeyhole className="mx-auto h-8 w-8 text-market" />
          <p className="text-sm text-muted-foreground">
            Sign in to your customer account to view this section.
          </p>
          <Button asChild className="bg-market text-market-foreground hover:bg-market/90">
            <Link to={`/customer-auth?next=${encodeURIComponent(location.pathname)}`}>Login or Register</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
