import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Truck } from "lucide-react";
import { whatsappLink } from "@/lib/whatsapp";
import { deliveryStatusMessages } from "@/lib/delivery";

const STATUSES = ["Pending", "Confirmed", "Out for Delivery", "Delivered"];

const AdminOrders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const { toast } = useToast();

  const load = () => {
    supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setOrders(data ?? []));
  };

  useEffect(load, []);

  const updateStatus = async (id: string, status: string, phone: string, name: string) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    toast({ title: `Status updated to ${status}` });
    load();

    // Open WhatsApp with status update message
    const msg = `Hello ${name}, ${deliveryStatusMessages[status]}`;
    window.open(whatsappLink(msg), "_blank");
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Truck className="w-5 h-5" /> Orders & Delivery
      </h2>

      {orders.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No orders yet</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const items = (o.items as any[]) || [];
            return (
              <Card key={o.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-sm font-bold">{o.order_number}</CardTitle>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        o.status === "Delivered"
                          ? "bg-green-100 text-green-700"
                          : o.status === "Out for Delivery"
                          ? "bg-blue-100 text-blue-700"
                          : o.status === "Confirmed"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {o.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm space-y-0.5">
                    <p><strong>Customer:</strong> {o.customer_name} • {o.customer_phone}</p>
                    <p><strong>Location:</strong> {o.customer_location} {o.delivery_zone && `(${o.delivery_zone})`}</p>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {items.map((item: any, i: number) => (
                      <p key={i}>• {item.name} x{item.qty} — KES {(item.price * item.qty).toLocaleString()}</p>
                    ))}
                  </div>

                  <div className="text-sm font-medium space-y-0.5">
                    <p>Products: KES {Number(o.product_total).toLocaleString()}</p>
                    <p>Delivery: {Number(o.delivery_fee) === 0 ? "FREE" : `KES ${Number(o.delivery_fee).toLocaleString()}`}</p>
                    <p className="text-primary font-bold">Total: KES {Number(o.grand_total).toLocaleString()}</p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {STATUSES.filter((s) => s !== o.status).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => updateStatus(o.id, s, o.customer_phone, o.customer_name)}
                      >
                        {s === "Out for Delivery" ? "🚚" : s === "Delivered" ? "✅" : s === "Confirmed" ? "👍" : "⏳"} {s}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
