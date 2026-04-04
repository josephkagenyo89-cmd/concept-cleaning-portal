import { supabase } from '@/integrations/supabase/client';

/**
 * Find or create a client by phone number.
 * Updates client stats (booking_count, total_spend, last_booking_date, status) on each booking.
 */
export async function upsertClientForBooking(params: {
  clientName: string;
  clientPhone: string;
  location: string;
  bookingPrice: number;
  createdBy: string;
  createdByRole: string;
}): Promise<string | null> {
  const { clientName, clientPhone, location, bookingPrice, createdBy, createdByRole } = params;
  const phone = clientPhone.trim();
  if (!phone) return null;

  // Check if client exists
  const { data: existing } = await supabase
    .from('clients')
    .select('id, booking_count, total_spend')
    .eq('phone', phone)
    .maybeSingle();

  if (existing) {
    const newCount = (existing as any).booking_count + 1;
    const newSpend = Number((existing as any).total_spend) + bookingPrice;
    let status = 'returning';
    if (newSpend >= 50000) status = 'vip';

    await supabase.from('clients').update({
      full_name: clientName,
      location,
      booking_count: newCount,
      total_spend: newSpend,
      last_booking_date: new Date().toISOString().split('T')[0],
      status,
      updated_at: new Date().toISOString(),
    } as any).eq('id', (existing as any).id);

    return (existing as any).id;
  }

  // Create new client
  const { data: newClient, error } = await supabase.from('clients').insert({
    full_name: clientName,
    phone,
    whatsapp_number: phone,
    location,
    total_spend: bookingPrice,
    booking_count: 1,
    last_booking_date: new Date().toISOString().split('T')[0],
    status: 'new',
    created_by: createdBy,
    created_by_role: createdByRole,
  } as any).select('id').single();

  if (error) {
    console.error('Client creation error:', error);
    return null;
  }

  return (newClient as any)?.id || null;
}
