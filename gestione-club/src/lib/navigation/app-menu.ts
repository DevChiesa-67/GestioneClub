// src/lib/navigation/app-menu.ts

import {
  Activity,
  AreaChartIcon,
  BotIcon,
  BriefcaseMedical,
  Building2,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  FileText,
  Folder,
  LayoutDashboard,
  Megaphone,
  Settings,
  Shield,
  Trophy,
  Users,
} from "lucide-react";

export type AppMenuItem = {
  label: string;
  href: string;
  permissionKey: string;
  icon: typeof LayoutDashboard;
  showInSidebar?: boolean;
  showInMobileMenu?: boolean;
  showInUserMenu?: boolean;
};

export const APP_MENU_ITEMS: AppMenuItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    permissionKey: "dashboard",
    icon: LayoutDashboard,
    showInSidebar: true,
    showInMobileMenu: true,
  },
  {
    label: "AI Chatbot",
    href: "/ai-chat",
    permissionKey: "ai_chat",
    icon: BotIcon,
    showInSidebar: true,
    showInMobileMenu: true,
  },
  {
    label: "Giocatori",
    href: "/giocatori",
    permissionKey: "giocatori",
    icon: Users,
    showInSidebar: true,
    showInMobileMenu: true,
  },
  {
    label: "Programmazione",
    href: "/allenamenti/programmazione",
    permissionKey: "programmazione",
    icon: CalendarDays,
    showInSidebar: true,
    showInMobileMenu: true,
  },
  {
    label: "Allenamenti",
    href: "/allenamenti",
    permissionKey: "allenamenti",
    icon: Dumbbell,
    showInSidebar: true,
    showInMobileMenu: true,
  },
  {
    label: "Test",
    href: "/test",
    permissionKey: "test",
    icon: ClipboardList,
    showInSidebar: true,
    showInMobileMenu: true,
  },
  {
    label: "Partite",
    href: "/partite",
    permissionKey: "partite",
    icon: Trophy,
    showInSidebar: true,
    showInMobileMenu: true,
  },
  {
    label: "Performance",
    href: "/performance",
    permissionKey: "performance",
    icon: Activity,
    showInSidebar: true,
    showInMobileMenu: true,
  },
  {
    label: "Importa dati",
    href: "/performance/importa-dati",
    permissionKey: "performance_importa_dati",
    icon: AreaChartIcon,
    showInSidebar: false,
    showInMobileMenu: true,
  },
  {
    label: "Misurazioni",
    href: "/misurazioni",
    permissionKey: "misurazioni",
    icon: Users,
    showInSidebar: true,
    showInMobileMenu: true,
  },
  {
    label: "Comunicazioni",
    href: "/comunicazioni",
    permissionKey: "comunicazioni",
    icon: Megaphone,
    showInSidebar: true,
    showInMobileMenu: true,
  },
  {
    label: "Infortuni",
    href: "/infortuni",
    permissionKey: "infortuni",
    icon: BriefcaseMedical,
    showInSidebar: true,
    showInMobileMenu: true,
  },
  {
    label: "File",
    href: "/file",
    permissionKey: "file",
    icon: Folder,
    showInSidebar: true,
    showInMobileMenu: true,
  },
  {
    label: "Giocate",
    href: "/giocate",
    permissionKey: "giocate",
    icon: ClipboardList,
    showInSidebar: true,
    showInMobileMenu: true,
  },
  {
    label: "Reportistica",
    href: "/reportistica",
    permissionKey: "reportistica",
    icon: AreaChartIcon,
    showInMobileMenu: true,
    showInUserMenu: true,
  },
  {
    label: "Utenti",
    href: "/utenti-permessi",
    permissionKey: "utenti_permessi",
    icon: Shield,
    showInMobileMenu: true,
    showInUserMenu: true,
  },
  {
    label: "Club",
    href: "/club",
    permissionKey: "club",
    icon: Building2,
    showInMobileMenu: true,
    showInUserMenu: true,
  },
  {
    label: "Impostazioni",
    href: "/impostazioni",
    permissionKey: "impostazioni",
    icon: Settings,
    showInMobileMenu: true,
    showInUserMenu: true,
  },
];

export function isMenuItemActive(
  pathname: string,
  href: string
): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}