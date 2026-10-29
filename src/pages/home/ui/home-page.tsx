import { DayScheduleView, ScheduleStatus } from "@/widgets/day-schedule";
import { MeetingManagement } from "@/widgets/meeting-management";
import { HomePageFooter } from "./home-page-footer";
import { HomePageHeader } from "./home-page-header";

export function HomePage() {
  return (
    <section className="mx-auto w-full max-w-7xl space-y-7 px-4 py-8 sm:py-12">
      <HomePageHeader />
      <ScheduleStatus />
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_22rem]">
        <DayScheduleView />
        <MeetingManagement />
      </div>
      <HomePageFooter />
    </section>
  );
}
