import { startOfDay, endOfDay, subDays, startOfWeek, startOfMonth } from "date-fns";
import type { DashboardFilters } from "./types";

export interface DateRanges {
  start: string;
  end: string;
  today: string;
  endToday: string;
  weekStart: string;
  monthStart: string;
}

export function buildDateRanges(filters: DashboardFilters): DateRanges {
  const now = new Date();
  const today = startOfDay(now);
  const endToday = endOfDay(now);

  let startDate: Date;
  let endDate: Date = endToday;

  switch (filters.dateRange) {
    case "today":
      startDate = today;
      break;
    case "7d":
      startDate = subDays(today, 7);
      break;
    case "30d":
      startDate = subDays(today, 30);
      break;
    case "custom":
      startDate = filters.customStartDate || subDays(today, 30);
      endDate = filters.customEndDate ? endOfDay(filters.customEndDate) : endToday;
      break;
    default:
      startDate = today;
  }

  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    today: today.toISOString(),
    endToday: endToday.toISOString(),
    weekStart: startOfWeek(now, { weekStartsOn: 1 }).toISOString(),
    monthStart: startOfMonth(now).toISOString(),
  };
}
