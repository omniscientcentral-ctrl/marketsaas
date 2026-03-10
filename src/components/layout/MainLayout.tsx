import { ReactNode } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import BottomNav from "@/components/BottomNav";
import { EmpresaSelector } from "@/components/EmpresaSelector";

interface MainLayoutProps {
  children: ReactNode;
  showBottomNav?: boolean;
  defaultOpen?: boolean;
  showMobileHeader?: boolean;
}

export function MainLayout({ 
  children, 
  showBottomNav = true, 
  defaultOpen = true,
  showMobileHeader = true 
}: MainLayoutProps) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          {/* Mobile trigger + empresa selector - only visible on mobile */}
          {showMobileHeader && (
            <div className="md:hidden sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background px-4">
              <SidebarTrigger className="-ml-1" />
              <div className="ml-auto">
                <EmpresaSelector />
              </div>
            </div>
          )}
          <main className={`flex-1 ${showBottomNav ? 'pb-20 md:pb-0' : ''}`}>
            {children}
          </main>
        </SidebarInset>
      </div>
      {showBottomNav && <BottomNav />}
    </SidebarProvider>
  );
}

export default MainLayout;
