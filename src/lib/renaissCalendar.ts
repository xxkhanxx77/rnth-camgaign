export type YearRange = { min: number; max: number };

export type CalendarDay = {
  key: string;
  date: Date;
  count: number;
  inYear: boolean;
  future: boolean;
};

export type PostsSummary = {
  years: number[];
  countsByYear: Map<number, Map<string, number>>;
  totalsByYear: Map<number, number>;
  rangesByYear: Map<number, YearRange>;
};

export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function activityLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

export function summarizePostsByYear(
  posts: Array<{ timestamp: number }>,
): PostsSummary {
  const counts = new Map<number, Map<string, number>>();
  const totals = new Map<number, number>();
  const ranges = new Map<number, YearRange>();

  for (const post of posts) {
    if (!post.timestamp) {
      continue;
    }

    const date = new Date(post.timestamp);
    const year = date.getFullYear();
    const yearCounts = counts.get(year) ?? new Map<string, number>();
    const key = dayKey(date);

    yearCounts.set(key, (yearCounts.get(key) ?? 0) + 1);
    counts.set(year, yearCounts);
    totals.set(year, (totals.get(year) ?? 0) + 1);

    const range = ranges.get(year);
    ranges.set(year, {
      min: range ? Math.min(range.min, post.timestamp) : post.timestamp,
      max: range ? Math.max(range.max, post.timestamp) : post.timestamp,
    });
  }

  return {
    years: [...counts.keys()].sort((first, second) => second - first),
    countsByYear: counts,
    totalsByYear: totals,
    rangesByYear: ranges,
  };
}

export function buildHeatmapWeeks(
  year: number,
  counts: Map<string, number> | undefined,
  range: YearRange | undefined,
): CalendarDay[][] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Focus the calendar on the active posting window instead of an empty full
  // year. Snap to whole weeks so columns stay aligned.
  const start = range ? new Date(range.min) : new Date(year, 0, 1);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = range ? new Date(range.max) : new Date(year, 11, 31);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + (6 - end.getDay()));

  const weeks: CalendarDay[][] = [];
  let current: CalendarDay[] = [];

  for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    const date = new Date(day);
    const inYear = date.getFullYear() === year;

    current.push({
      key: date.toISOString(),
      date,
      inYear,
      future: date.getTime() > today.getTime(),
      count: inYear ? counts?.get(dayKey(date)) ?? 0 : 0,
    });

    if (current.length === 7) {
      weeks.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    weeks.push(current);
  }

  return weeks;
}

export function monthLabelsForWeeks(
  weeks: CalendarDay[][],
): Array<string | null> {
  const labels: Array<string | null> = [];
  let lastMonth = -1;

  for (const week of weeks) {
    const firstInYear = week.find((day) => day.inYear);

    if (firstInYear && firstInYear.date.getMonth() !== lastMonth) {
      lastMonth = firstInYear.date.getMonth();
      labels.push(MONTH_LABELS[lastMonth]);
    } else {
      labels.push(null);
    }
  }

  return labels;
}
