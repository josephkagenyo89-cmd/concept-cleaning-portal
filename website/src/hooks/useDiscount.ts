import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useDiscount = () => {
  const [discount, setDiscount] = useState(0);

  useEffect(() => {
    supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "discount_percentage")
      .single()
      .then(({ data }) => {
        if (data) setDiscount(parseFloat(data.value) || 0);
      });
  }, []);

  const applyDiscount = (price: number) => {
    if (discount <= 0) return price;
    return Math.round(price * (1 - discount / 100));
  };

  return { discount, applyDiscount };
};
