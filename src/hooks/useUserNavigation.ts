import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { navigationItems, NavigationItem, getNavigationForRoles } from "@/config/navigation";

export const useUserNavigation = () => {
  const { userRoles, activeRole, loading } = useAuth();

  const allowedNavigation = useMemo<NavigationItem[]>(() => {
    if (!userRoles || userRoles.length === 0) {
      // Fallback to activeRole if userRoles not loaded yet
      if (activeRole) {
        return getNavigationForRoles([activeRole]);
      }
      return [];
    }

    // Union of all pages accessible by any of the user's roles
    return getNavigationForRoles(userRoles);
  }, [userRoles, activeRole]);

  return {
    navigationItems: allowedNavigation,
    loading,
  };
};
