import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

const UpdatePrompt = () => {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        setInterval(() => r.update(), 30 * 60 * 1000);
      }
    },
  });

  useEffect(() => {
    if (needRefresh) {
      updateServiceWorker(true);
    }
  }, [needRefresh]);

  return null;
};

export default UpdatePrompt;
