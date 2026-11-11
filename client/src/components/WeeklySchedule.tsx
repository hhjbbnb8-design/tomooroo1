import { CalendarDays, Clock3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const periods = [
  { time: "7:30–8:15", key: "first" },
  { time: "8:20–9:15", key: "second" },
  { time: "9:15–9:55", key: "third" },
  { time: "10:00–10:30", key: "break" },
  { time: "10:30–11:15", key: "last" },
] as const;

const schedule = [
  { day: "Sunday", first: "Math", second: "Arabic", third: "English", last: "Science" },
  { day: "Monday", first: "Math", second: "Library", third: "English", last: "Science" },
  { day: "Tuesday", first: "Math", second: "Arabic", third: "English", last: "Science" },
  { day: "Wednesday", first: "Math", second: "Arabic", third: "English", last: "Reading Activity" },
  { day: "Thursday", first: "Math", second: "Arabic", third: "English", last: "Math Quizzes" },
] as const;

const subjectStyles: Record<string, string> = {
  Math: "border-orange-200 bg-orange-50 text-orange-800",
  Arabic: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
  Library: "border-purple-200 bg-purple-50 text-purple-800",
  English: "border-sky-200 bg-sky-50 text-sky-800",
  Science: "border-lime-200 bg-lime-50 text-lime-800",
  "Reading Activity": "border-blue-200 bg-blue-50 text-blue-800",
  "Math Quizzes": "border-orange-200 bg-orange-100 text-orange-900",
};

export function WeeklySchedule() {
  const currentDay = new Date().getDay();

  return (
    <Card className="mt-8 overflow-hidden border-border/80 bg-card">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <CalendarDays className="h-4 w-4 text-primary" />
            Grade 8 weekly timetable
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Tomorrow School · Sunday to Thursday</p>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-[11px] text-muted-foreground sm:inline-flex">
          <Clock3 className="h-3.5 w-3.5" />
          All times are local
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-center text-xs">
            <thead>
              <tr className="bg-secondary/45 text-muted-foreground">
                <th className="w-28 border-b border-r border-border/70 px-3 py-3 text-left font-semibold">Day / Time</th>
                {periods.map(period => (
                  <th key={period.key} className="border-b border-r border-border/70 px-3 py-3 font-semibold last:border-r-0">
                    {period.time}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedule.map((row, index) => {
                const isToday = currentDay === index;
                return (
                  <tr key={row.day} className={cn(isToday && "bg-primary/[0.035]")}>
                    <th className={cn("border-b border-r border-border/70 px-3 py-3 text-left font-semibold text-ink", isToday && "text-primary")}>
                      <span className="flex items-center gap-2">
                        {isToday && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                        {row.day}
                      </span>
                    </th>
                    <td className={cn("border-b border-r border-border/70 p-1.5", isToday && "ring-1 ring-inset ring-primary/15")}>
                      <span className={cn("block rounded-lg border px-2 py-2.5 font-medium", subjectStyles[row.first])}>{row.first}</span>
                    </td>
                    <td className={cn("border-b border-r border-border/70 p-1.5", isToday && "ring-1 ring-inset ring-primary/15")}>
                      <span className={cn("block rounded-lg border px-2 py-2.5 font-medium", subjectStyles[row.second])}>{row.second}</span>
                    </td>
                    <td className={cn("border-b border-r border-border/70 p-1.5", isToday && "ring-1 ring-inset ring-primary/15")}>
                      <span className={cn("block rounded-lg border px-2 py-2.5 font-medium", subjectStyles[row.third])}>{row.third}</span>
                    </td>
                    <td className="border-b border-r border-border/70 bg-secondary/25 p-1.5">
                      <span className="block rounded-lg border border-border bg-background/70 px-2 py-2.5 font-medium text-muted-foreground">Break</span>
                    </td>
                    <td className={cn("border-b border-border/70 p-1.5", isToday && "ring-1 ring-inset ring-primary/15")}>
                      <span className={cn("block rounded-lg border px-2 py-2.5 font-medium", subjectStyles[row.last])}>{row.last}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
