import { Card, CardContent } from '@/components/ui/card';

export default function AdminAnalytics() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Analytics & Reports</h1>
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Analytics charts coming soon — revenue over time, bookings by service, top agents, tier distribution.
        </CardContent>
      </Card>
    </div>
  );
}
