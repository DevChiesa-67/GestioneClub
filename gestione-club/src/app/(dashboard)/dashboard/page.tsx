import DashboardStats from "@/components/dashboard/DashboardStats";
import DashboardEvents from "@/components/dashboard/DashboardEvents";
import DashboardPerformance from "@/components/dashboard/DashboardPerformance";
import DashboardCommunications from "@/components/dashboard/DashboardCommunications";
import DashboardReports from "@/components/dashboard/DashboardReports";
import DashboardMedical from "@/components/dashboard/DashboardMedical";

export default function DashboardPage() {
  return (
    <div className="min-w-0 space-y-4 sm:space-y-5 lg:space-y-6">
      <section className="min-w-0">
        <DashboardStats />
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-[0.9fr_1.1fr] xl:gap-6">
        <DashboardEvents />
        <DashboardPerformance />
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3 xl:gap-6">
        <DashboardCommunications />
        <DashboardReports />
        <div className="sm:col-span-2 xl:col-span-1">
          <DashboardMedical />
        </div>
      </section>
    </div>
  );
}