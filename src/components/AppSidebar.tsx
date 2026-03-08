import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, Sun, Moon, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { useUserNavigation } from "@/hooks/useUserNavigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, activeRole, signOut } = useAuth();
  const { navigationItems } = useUserNavigation();
  const { state, isMobile, toggleSidebar } = useSidebar();
  const { theme, setTheme } = useTheme();

  const isCollapsed = state === "collapsed";

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/auth");
      toast.success("Sesión cerrada");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      navigate("/auth");
      toast.error("Error al cerrar sesión");
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Header */}
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-center p-2">
          {!isCollapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-semibold truncate">
                {user?.email?.split("@")[0] || "Usuario"}
              </span>
              <span className="text-xs text-muted-foreground capitalize">
                {activeRole || "Sin rol"}
              </span>
            </div>
          )}
          {isCollapsed && (
            <span className="text-xs font-bold uppercase">
              {activeRole?.substring(0, 3) || "USR"}
            </span>
          )}
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.path)}
                    isActive={isActive(item.path)}
                    tooltip={item.label}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          {/* Theme toggle */}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleTheme} tooltip="Cambiar tema">
              <div className="relative h-5 w-5">
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 absolute inset-0" />
                <Moon className="h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 absolute inset-0" />
              </div>
              {!isCollapsed && <span>Cambiar tema</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Expand/collapse toggle (desktop only) */}
          {!isMobile && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={toggleSidebar}
                tooltip={isCollapsed ? "Expandir" : "Colapsar"}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-5 w-5" />
                ) : (
                  <ChevronLeft className="h-5 w-5" />
                )}
                <span>{isCollapsed ? "Expandir" : "Colapsar"}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {/* Sign out */}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut} tooltip="Cerrar Sesión">
              <LogOut className="h-5 w-5" />
              <span>Cerrar Sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;
