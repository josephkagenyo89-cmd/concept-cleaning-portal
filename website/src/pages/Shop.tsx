import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Plus, Minus, Package } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { motion } from "framer-motion";
import PageHead from "@/components/PageHead";
import ShopCheckout from "@/components/ShopCheckout";
import ProductGallery from "@/components/ProductGallery";
import { getFreeDeliveryRemaining, FREE_DELIVERY_THRESHOLD_VALUE } from "@/lib/delivery";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4 } }),
};

const Shop = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const { items, addItem, updateQty, removeItem, total, count } = useCart();

  useEffect(() => {
    supabase
      .from("website_shop_products")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        setProducts(data ?? []);
        setLoading(false);
      });
  }, []);

  const getCartQty = (id: string) => items.find((i) => i.id === id)?.qty ?? 0;
  const remaining = getFreeDeliveryRemaining(total);

  return (
    <div className="py-12 sm:py-16">
      <PageHead
        title="Buy Cleaning Products | Concept Cleaning Services Nairobi"
        description="Shop premium cleaning detergents, stain removers, carpet shampoo, and more. Fast delivery in Nairobi, Kiambu, Kajiado & Machakos."
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            🧴 Cleaning Products Shop
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Professional-grade cleaning products delivered to your door. The same products we use in our services!
          </p>
          <p className="text-sm text-primary font-semibold mt-2">
            🎁 FREE delivery on orders above KES {FREE_DELIVERY_THRESHOLD_VALUE.toLocaleString()}!
          </p>
        </div>

        {/* Product detail modal */}
        {selectedProduct && (
          <div className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-4" onClick={() => setSelectedProduct(null)}>
            <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <CardContent className="p-5 space-y-4">
                <ProductGallery
                  mainImage={selectedProduct.image_url}
                  additionalImages={selectedProduct.additional_images || []}
                  name={selectedProduct.name}
                />
                <h2 className="text-xl font-bold text-foreground">{selectedProduct.name}</h2>
                <p className="text-muted-foreground text-sm">{selectedProduct.description}</p>
                <p className="text-xl font-bold text-primary">KES {Number(selectedProduct.price).toLocaleString()}</p>
                <Button
                  className="w-full"
                  onClick={() => {
                    addItem({ id: selectedProduct.id, name: selectedProduct.name, price: selectedProduct.price, image_url: selectedProduct.image_url });
                    setSelectedProduct(null);
                  }}
                >
                  <ShoppingCart className="w-4 h-4 mr-1" /> Add to Cart
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse h-72" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p, i) => {
              const qty = getCartQty(p.id);
              return (
                <motion.div key={p.id} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedProduct(p)}>
                    <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <Package className="w-16 h-16 text-muted-foreground/40" />
                      )}
                    </div>
                    <CardContent className="p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
                      <h3 className="font-semibold text-foreground">{p.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                      <p className="text-lg font-bold text-primary">KES {Number(p.price).toLocaleString()}</p>

                      {qty === 0 ? (
                        <Button
                          className="w-full"
                          onClick={() => addItem({ id: p.id, name: p.name, price: p.price, image_url: p.image_url })}
                        >
                          <ShoppingCart className="w-4 h-4 mr-1" /> Add to Cart
                        </Button>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <Button size="icon" variant="outline" onClick={() => updateQty(p.id, qty - 1)}>
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="font-semibold text-foreground">{qty}</span>
                          <Button size="icon" variant="outline" onClick={() => updateQty(p.id, qty + 1)}>
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => removeItem(p.id)}>
                            Remove
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Floating Cart Bar */}
        {count > 0 && !showCheckout && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-xl flex items-center gap-4"
          >
            <ShoppingCart className="w-5 h-5" />
            <div className="text-center">
              <span className="font-semibold">{count} item{count > 1 ? "s" : ""} — KES {total.toLocaleString()}</span>
              {remaining > 0 && (
                <p className="text-xs opacity-80">Add KES {remaining.toLocaleString()} more for FREE delivery 🎁</p>
              )}
            </div>
            <Button size="sm" variant="secondary" onClick={() => setShowCheckout(true)}>
              Checkout
            </Button>
          </motion.div>
        )}

        {showCheckout && <ShopCheckout onClose={() => setShowCheckout(false)} />}
      </div>
    </div>
  );
};

export default Shop;
