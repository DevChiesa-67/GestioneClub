import {
  LayoutDashboard,
  Building2,
  Shirt,
  Users,
  Dumbbell,
  CalendarDays,
  LineChart,
  MessageSquare,
  FileText,
  Folder,
  ShieldCheck,
  Settings,
} from "lucide-react";

export const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Club", href: "/club", icon: Building2 },
  { label: "Squadre", href: "/squadre", icon: Shirt },
  { label: "Giocatori", href: "/giocatori", icon: Users },
  { label: "Allenamenti", href: "/allenamenti", icon: Dumbbell },
  { label: "Partite", href: "/partite", icon: CalendarDays },
  { label: "Performance", href: "/performance", icon: LineChart },
  { label: "Comunicazioni", href: "/comunicazioni", icon: MessageSquare },
  { label: "Report", href: "/report", icon: FileText },
  { label: "File", href: "/file", icon: Folder },
  { label: "Utenti e permessi", href: "/utenti-permessi", icon: ShieldCheck },
  { label: "Impostazioni", href: "/impostazioni", icon: Settings },
];
