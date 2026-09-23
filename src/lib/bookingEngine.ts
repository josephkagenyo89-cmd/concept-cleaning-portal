import { supabase } from '@/integrations/supabase/client';

export async function createBookingEngineRequest(params: {
  requestedDate?: string;
  requestedTime?: string;
  serviceLocation?: string;
  customerNotes?: string;
}) {
  const { data, error } = await supabase.rpc(
    'create_booking_engine_request',
    {
      _requested_date: params.requestedDate || undefined,
      _requested_time: params.requestedTime || undefined,
      _service_location: params.serviceLocation || undefined,
      _customer_notes: params.customerNotes || undefined,
    }
  );

  if (error) throw error;

  return data as string;
}

export async function updateBookingEngineRequest(params: {
  requestId: string;
  requestedDate?: string;
  requestedTime?: string;
  serviceLocation?: string;
  customerNotes?: string;
  acknowledgedScope: boolean;
}) {
  const { data, error } = await supabase.rpc(
    'update_booking_engine_request',
    {
      _request_id: params.requestId,
      _requested_date: params.requestedDate || undefined,
      _requested_time: params.requestedTime || undefined,
      _service_location: params.serviceLocation || undefined,
      _customer_notes: params.customerNotes || undefined,
      _customer_acknowledged_scope: params.acknowledgedScope,
    }
  );
  if (error) throw error;
  return data as string;
}

export async function addBookingEngineRequestItem(params: {
  requestId: string;
  serviceId: string;
  quantity?: number;
  measurements?: Record<string, unknown>;
  answers?: Record<string, unknown>;
  selectedExtras?: unknown[];
}) {
  const { data, error } = await supabase.rpc(
    'add_booking_engine_request_item',
    {
      _request_id: params.requestId,
      _service_id: params.serviceId,
      _quantity: params.quantity,
      _measurements: params.measurements || {},
      _answers: params.answers || {},
      _selected_extras: params.selectedExtras || [],
    }
  );

  if (error) throw error;

  return data as string;
}

export async function updateBookingEngineRequestItem(params: {
  itemId: string;
  quantity?: number;
  measurements?: Record<string, unknown>;
  answers?: Record<string, unknown>;
  selectedExtras?: unknown[];
}) {
  const { data, error } = await supabase.rpc(
    'update_booking_engine_request_item',
    {
      _item_id: params.itemId,
      _quantity: params.quantity,
      _measurements: params.measurements || {},
      _answers: params.answers || {},
      _selected_extras: params.selectedExtras || [],
    }
  );

  if (error) throw error;

  return data as string;
}

export async function calculateBookingEngineRequestPrice(
  requestId: string
) {
  const { data, error } = await supabase.rpc(
    'calculate_booking_engine_request_price',
    {
      _request_id: requestId,
    }
  );

  if (error) throw error;

  return data;
}

export async function submitBookingEngineRequest(
  requestId: string
) {
  const { data, error } = await supabase.rpc(
    'submit_booking_engine_request',
    {
      _request_id: requestId,
    }
  );

  if (error) throw error;

  return data as string;
}
