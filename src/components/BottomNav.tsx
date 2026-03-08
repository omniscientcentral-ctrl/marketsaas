import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useUserNavigation } from "@/hooks/useUserNavigation";
import { useSidebar } from "@/components/ui/sidebar";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { navigationItems } = useUserNavigation();
  
  // Get sidebar context if available
  let openMobile = false;
  try {
    const sidebar = useSidebar();
    openMobile = sidebar.openMobile;
  } catch {
    // Not within SidebarProvider - that's ok
  }

  // Take first 5 items for mobile nav
  const navItems = navigationItems.slice(0, 5);

  const isActive = (path: string) => location.pathname === path;

  // Hide bottom nav when mobile sidebar is open
  if (openMobile) return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="grid grid-cols-5 h-16">
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant="ghost"
            className={`flex flex-col items-center justify-center gap-1 h-full rounded-none ${
              isActive(item.path) ? "text-primary" : "text-muted-foreground"
            }`}
            onClick={() => navigate(item.path)}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs">{item.mobileLabel || item.label}</span>
          </Button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
