import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, X, Minus, Plus, Truck } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { getDeliveryFee, getFreeDeliveryRemaining, generateOrderNumber, FREE_DELIVERY_THRESHOLD_VALUE, type DeliveryZone } from "@/lib/delivery";
import OrderConfirmation from "@/components/OrderConfirmation";
import { toast } from "sonner";

const ShopCheckout = ({ onClose }: { onClose: () => void }) => {
  const { items, total, updateQty, clearCart } = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [orderPlaced, setOrderPlaced] = useState<any>(null);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => {
    supabase.from("website_delivery_zones").select("*").then(({ data }) => setZones((data as DeliveryZone[]) ?? []));
  }, []);

  const delivery = getDeliveryFee(total, location, zones);
  const grandTotal = total + delivery.fee;
  const remaining = getFreeDeliveryRemaining(total);

  const handleOrder = async () => {
    if (!name.trim() || !phone.trim() || !location.trim() || orderSubmitting) return;
    setOrderSubmitting(true);
    try {
      const orderItems = items.map((i) => ({ name: i.name, qty: i.qty, price: i.price }));
      const { data, error } = await supabase.rpc("submit_website_shop_order", {
        p_payload: {
          idempotency_key: idempotencyKey.current,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          customer_location: location.trim(),
          items: items.map((i) => ({ product_id: i.id, quantity: i.qty })),
        },
      });
      if (error) throw error;
      setOrderPlaced({
        orderNumber: data.order_number,
        items: orderItems,
        productTotal: Number(data.product_total),
        deliveryFee: Number(data.delivery_fee),
        grandTotal: Number(data.grand_total),
        customerName: name,
        customerPhone: phone,
        location,
        status: "Pending",
      });
      idempotencyKey.current = crypto.randomUUID();
      clearCart();
    } catch (error: any) {
      toast.error(error.message || "Unable to place your order. Please try again.");
    } finally {
      setOrderSubmitting(false);
    }
  };

  if (orderPlaced) {
    return <OrderConfirmation order={orderPlaced} onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-50 bg-foreground/50 flex items-end sm:items-center justify-center p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">🛒 Your Cart</CardTitle>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Your cart is empty</p>
          ) : (
            <>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 pb-3 border-b border-border">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">KES {item.price.toLocaleString()} each</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(item.id, item.qty - 1)}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-semibold">{item.qty}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(item.id, item.qty + 1)}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="text-sm font-semibold w-20 text-right">KES {(item.price * item.qty).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* Delivery info */}
              <div className="bg-muted rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Truck className="w-4 h-4" />
                  <span>Delivery</span>
                </div>
                {remaining > 0 ? (
                  <p className="text-xs text-primary font-semibold">
                    Add KES {remaining.toLocaleString()} more to get FREE delivery 🎁
                  </p>
                ) : (
                  <p className="text-xs font-semibold text-primary">You qualify for FREE delivery 🎉</p>
                )}
                {location.trim() && (
                  <p className="text-xs text-muted-foreground">
                    {delivery.freeDelivery ? "Free Delivery" : `${delivery.zone}: KES ${delivery.fee.toLocaleString()}`}
                  </p>
                )}
              </div>

              <div className="space-y-1 pt-2">
                <div className="flex justify-between text-sm">
                  <span>Products</span>
                  <span>KES {total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Delivery</span>
                  <span>{delivery.freeDelivery ? "FREE 🎉" : `KES ${delivery.fee.toLocaleString()}`}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-1">
                  <span>Total</span>
                  <span className="text-primary">KES {grandTotal.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Input placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} />
                <Input placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <Input placeholder="Delivery Location (e.g. Westlands, Ruaka)" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleOrder}
                disabled={!name.trim() || !phone.trim() || !location.trim() || orderSubmitting}
              >
                <MessageCircle className="w-4 h-4 mr-2" /> {orderSubmitting ? "Submitting…" : `Place Order — KES ${grandTotal.toLocaleString()}`}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ShopCheckout;
