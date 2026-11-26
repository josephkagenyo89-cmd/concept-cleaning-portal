import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/whatsapp";
import { deliveryStatusMessages } from "@/lib/delivery";

interface OrderData {
  orderNumber: string;
  items: { name: string; qty: number; price: number }[];
  productTotal: number;
  deliveryFee: number;
  grandTotal: number;
  customerName: string;
  customerPhone: string;
  location: string;
  status: string;
}

const OrderConfirmation = ({ order, onClose }: { order: OrderData; onClose: () => void }) => {
  const statusMsg = deliveryStatusMessages[order.status] || "";

  const whatsappMsg = `Hello Concept Cleaning Services,\n\nI would like to order:\n\n${order.items
    .map((i) => `• ${i.name} x${i.qty} — KES ${(i.price * i.qty).toLocaleString()}`)
    .join("\n")}\n\nProduct Total: KES ${order.productTotal.toLocaleString()}\nDelivery Fee: KES ${order.deliveryFee.toLocaleString()}\nTotal Amount: KES ${order.grandTotal.toLocaleString()}\n\nDelivery Location: ${order.location}\n\nMy Details:\nName: ${order.customerName}\nPhone: ${order.customerPhone}\n\nPlease confirm my order.`;

  return (
    <div className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader className="text-center pb-3">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <CardTitle className="text-lg">Order Placed!</CardTitle>
          <p className="text-sm text-muted-foreground">{statusMsg}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Order Number</p>
            <p className="text-lg font-bold text-primary">{order.orderNumber}</p>
          </div>

          <div className="space-y-1">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{item.name} x{item.qty}</span>
                <span className="font-medium">KES {(item.price * item.qty).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-2 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Products</span>
              <span>KES {order.productTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Delivery</span>
              <span>{order.deliveryFee === 0 ? "FREE 🎉" : `KES ${order.deliveryFee.toLocaleString()}`}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className="text-primary">KES {order.grandTotal.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button className="w-full" onClick={() => window.open(whatsappLink(whatsappMsg), "_blank")}>
              <MessageCircle className="w-4 h-4 mr-2" /> Confirm via WhatsApp
            </Button>
            <Button variant="outline" className="w-full" onClick={onClose}>
              Continue Shopping
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderConfirmation;
