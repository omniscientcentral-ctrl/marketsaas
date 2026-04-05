import { useState, useEffect } from "react";
import type { Customer } from "./usePOSTypes";

export function usePOSCustomer() {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(() => {
    try {
      const saved = sessionStorage.getItem("pos_customer");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [tempCustomer, setTempCustomer] = useState<Customer | null>(null);

  // Persist selected customer to sessionStorage
  useEffect(() => {
    try {
      if (selectedCustomer) {
        sessionStorage.setItem("pos_customer", JSON.stringify(selectedCustomer));
      } else {
        sessionStorage.removeItem("pos_customer");
      }
    } catch {}
  }, [selectedCustomer]);

  return {
    selectedCustomer,
    setSelectedCustomer,
    tempCustomer,
    setTempCustomer,
  };
}
