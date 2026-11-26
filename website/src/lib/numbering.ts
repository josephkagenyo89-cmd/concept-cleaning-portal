import { supabase } from "@/integrations/supabase/client";

export const generateBookingNumber = async (): Promise<string> => {
  const { count } = await supabase.from("bookings").select("id", { count: "exact", head: true });
  return `BK-${String((count ?? 0) + 1).padStart(3, "0")}`;
};

export const generateInvoiceNumber = async (): Promise<string> => {
  const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true });
  return `INV-${String((count ?? 0) + 1).padStart(3, "0")}`;
};

export const generateQuotationNumber = async (): Promise<string> => {
  const { count } = await supabase.from("quotations").select("id", { count: "exact", head: true });
  return `QTN-${String((count ?? 0) + 1).padStart(3, "0")}`;
};

export const generateLpoNumber = async (): Promise<string> => {
  const { count } = await supabase.from("lpos").select("id", { count: "exact", head: true });
  return `LPO-${String((count ?? 0) + 1).padStart(3, "0")}`;
};
