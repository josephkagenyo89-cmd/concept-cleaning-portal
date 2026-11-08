import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck, FileCheck, Wallet, CreditCard,
  UserRoundPen, ArrowUpRight, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type ApprovalCounts = {
  invoices: number;
  income: number;
  discounts: number;
  payouts: number;
  profileEdits: number;
  guestRequests: number | null;
};

const initialCounts: ApprovalCounts = {
  invoices: 0,
  income: 0,
  discounts: 0,
  payouts: 0,
  profileEdits: 0,
  guestRequests: null,
};

export default function AdminApprovalCentre() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [counts, setCounts] = useState<ApprovalCounts>(initialCounts);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [guestRequestError, setGuestRequestError] = useState<string | null>(null);

  const loadCounts = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    setGuestRequestError(null);

    try {
      const [invoices, income, discounts, payouts, guestRequests] = await Promise.all([
        supabase.from('invoices').select('id', { count: 'exact', head: true })
          .eq('payment_status', 'pending_approval'),
        isSuperAdmin
          ? supabase.from('income_records').select('id', { count: 'exact', head: true })
              .eq('status', 'pending_approval')
          : Promise.resolve({ count: 0, error: null }),
        supabase.from('bookings').select('id', { count: 'exact', head: true })
          .eq('discount_approval_status', 'pending'),
        supabase.from('payout_requests').select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase.from('guest_service_requests').select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'under_review']),
      ]);

      if (guestRequests.error) {
        setGuestRequestError(guestRequests.error.message);
      }

      const queueErrors = [invoices, income, discounts, payouts]
        .filter(result => result.error)
        .map(result => result.error!.message);

      if (queueErrors.length) {
        throw new Error(queueErrors.join('; '));
      }

      const profileRequests = await supabase
        .from('profile_edit_requests')
        .select('user_id')
        .eq('status', 'pending');

      if (profileRequests.error) {
        throw new Error(profileRequests.error.message);
      }

      const pendingProfileRequests = profileRequests.data ?? [];
      let profileEditCount = pendingProfileRequests.length;

      if (!isSuperAdmin && pendingProfileRequests.length) {
        const requesterIds = [...new Set(pendingProfileRequests.map(r => r.user_id))];
        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', requesterIds);

        if (rolesError) {
          throw new Error(rolesError.message);
        }

        // Match PendingProfileEdits role precedence: Super Admin > Admin > Agent.
        // Users without a role record default to Agent, as in that screen.
        const roleMap: Record<string, string> = {};
        (roles ?? []).forEach(r => {
          const current = roleMap[r.user_id];
          if (
            !current ||
            r.role === 'super_admin' ||
            (r.role === 'admin' && current === 'agent')
          ) {
            roleMap[r.user_id] = r.role;
          }
        });

        // Count each eligible request, including multiple requests by one agent.
        profileEditCount = pendingProfileRequests.filter(
          request => (roleMap[request.user_id] ?? 'agent') === 'agent'
        ).length;
      }

      setCounts({
        invoices: invoices.count ?? 0,
        income: income.count ?? 0,
        discounts: discounts.count ?? 0,
        payouts: payouts.count ?? 0,
        profileEdits: profileEditCount,
        guestRequests: guestRequests.error ? null : guestRequests.count ?? 0,
      });
    } catch (error) {
      console.error('Could not load approval counts:', error);
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Could not load approval counts. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isSuperAdmin]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const queues = [
    {
      key: 'invoices',
      title: 'Invoice Approvals',
      description: 'Invoices awaiting administrator approval.',
      count: counts.invoices,
      to: '/admin/erp/invoices',
      icon: FileCheck,
      visible: true,
    },
    {
      key: 'income',
      title: 'Income Approvals',
      description: 'Payment records awaiting Super Admin verification.',
      count: counts.income,
      to: '/admin/erp/income',
      icon: Wallet,
      visible: isSuperAdmin,
    },
    {
      key: 'discounts',
      title: 'Discount Approvals',
      description: 'Booking discounts awaiting review.',
      count: counts.discounts,
      to: '/admin/discount-approvals',
      icon: ClipboardCheck,
      visible: true,
    },
    {
      key: 'payouts',
      title: 'Agent Payouts',
      description: 'Agent payout requests awaiting processing.',
      count: counts.payouts,
      to: '/admin/payouts',
      icon: CreditCard,
      visible: true,
    },
    {
      key: 'guestRequests',
      title: 'Guest Service Requests',
      description: 'New and under-review guest enquiries awaiting admin review.',
      count: counts.guestRequests,
      to: '/admin/guest-requests',
      icon: ClipboardCheck,
      visible: true,
    },
    {
      key: 'profileEdits',
      title: 'Profile Edit Requests',
      description: 'Review pending staff profile changes on the admin overview.',
      count: counts.profileEdits,
      to: '/admin',
      icon: UserRoundPen,
      visible: true,
    },
  ];

  const visibleQueues = queues.filter(queue => queue.visible);
  const totalPending = visibleQueues.reduce((total, queue) => total + (queue.count ?? 0), 0);
  const hasUnavailableQueue = visibleQueues.some(queue => queue.count === null);

  if (!isAdmin) {
    return <div className="p-6 text-sm text-muted-foreground">You do not have permission to view approvals.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Approval Centre</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review pending requests across your existing approval workflows.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadCounts} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {guestRequestError && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Guest request count could not be loaded: {guestRequestError}
          <Button variant="link" size="sm" className="ml-1 h-auto p-0 text-destructive" onClick={loadCounts}>
            Try again
          </Button>
        </div>
      )}

      {loadError && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Approval counts could not be fully loaded: {loadError}
          <Button
            variant="link"
            size="sm"
            className="ml-1 h-auto p-0 text-destructive"
            onClick={loadCounts}
          >
            Try again
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Pending items in your queues</p>
            <p className="text-3xl font-bold mt-1">{loading || hasUnavailableQueue ? '—' : totalPending}</p>
          </div>
          <div className="rounded-full bg-primary/10 p-3">
            <ClipboardCheck className="h-6 w-6 text-primary" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleQueues.map(queue => {
          const Icon = queue.icon;

          return (
            <Card key={queue.key} className="flex flex-col">
              <CardContent className="p-5 flex flex-1 flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-lg bg-muted p-2.5">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-2xl font-semibold tabular-nums">
                    {loading || queue.count === null ? '—' : queue.count}
                  </span>
                </div>
                <div>
                  <h2 className="font-semibold">{queue.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{queue.description}</p>
                </div>
                <div className="mt-auto pt-2">
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to={queue.to}>
                      Open queue <ArrowUpRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        This centre displays pending counts and links to existing review screens. Approval actions,
        permissions and audit processes remain in their original modules.
      </p>
    </div>
  );
}
