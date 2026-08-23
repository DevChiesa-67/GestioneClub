"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import ClaudeChatbot from "@/components/ai/ClaudeChatbot";
import { PushSubscriptionManager } from "@/components/notifiche/PushSubscriptionManager";
import { ToastProvider } from "@/components/ui/Toast";
import { usePagePermissions } from "@/hooks/use-page-permissions";
import {
  appartieneAllaSezione,
  pulisciFiltriAllenamenti,
} from "@/lib/allenamenti/filtri-sezione";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { loading: permissionsLoading, isAdmin } = usePagePermissions();
  const pathname = usePathname();

  /*
   * I filtri della pagina Allenamenti sopravvivono agli spostamenti
   * dentro la sezione (elenco -> seduta -> elenco) e si azzerano appena
   * si esce. La pulizia sta qui perche' AppShell e' l'unico componente
   * client montato su OGNI pagina della dashboard: la pagina Allenamenti
   * non puo' occuparsene da sola, visto che quando si esce e' gia' stata
   * smontata e non riceve piu' nessun evento.
   */
  useEffect(() => {
    if (!appartieneAllaSezione(pathname)) {
      pulisciFiltriAllenamenti();
    }
  }, [pathname]);

  return (
    <ToastProvider>
    <div className="min-h-screen min-w-0 overflow-hidden bg-[#090909] text-white">
      <PushSubscriptionManager />

      <div className="hidden lg:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />
      </div>

      <div
        className={`flex min-h-screen min-w-0 flex-1 flex-col transition-all duration-300 ${
          sidebarCollapsed ? "lg:ml-20" : "lg:ml-60"
        }`}
      >
        <Topbar />

        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#090909] p-4 pb-28 sm:p-5 sm:pb-28 lg:pb-5">
          <div className="mx-auto w-full min-w-0 max-w-[1700px] overflow-hidden">
            {children}
          </div>

          {!permissionsLoading && isAdmin && <ClaudeChatbot />}
        </main>
      </div>


    </div>
    </ToastProvider>
  );
}