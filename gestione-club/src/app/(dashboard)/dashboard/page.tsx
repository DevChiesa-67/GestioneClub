import DashboardStats from "@/components/dashboard/DashboardStats";
import DashboardProssimePartite from "@/components/dashboard/DashboardProssimePartite";
import DashboardProssimiAllenamenti from "@/components/dashboard/DashboardProssimiAllenamenti";
import DashboardAttendance from "@/components/dashboard/DashboardAttendance";
import DashboardCommunications from "@/components/dashboard/DashboardCommunications";
import DashboardMedical from "@/components/dashboard/DashboardMedical";

export default function DashboardPage() {
  return (
    <div className="min-w-0 space-y-4 sm:space-y-5 lg:space-y-6">
      <section className="min-w-0">
        <DashboardStats />
      </section>

      <section className="min-w-0">
        <DashboardAttendance />
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-2 xl:gap-6">
        <DashboardProssimePartite />
        <DashboardProssimiAllenamenti />
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:gap-6">
        <DashboardCommunications />
        <DashboardMedical />
      </section>
    </div>
  );
}
