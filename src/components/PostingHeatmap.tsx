import { useMemo, useState } from "react";
import { cn } from "../lib/utils";
import {
  activityLevel,
  buildHeatmapWeeks,
  monthLabelsForWeeks,
  summarizePostsByYear,
} from "../lib/renaissCalendar";

type HeatPost = { timestamp: number };

const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

export function PostingHeatmap({ posts }: { posts: HeatPost[] }) {
  const { years, countsByYear, totalsByYear, rangesByYear } = useMemo(
    () => summarizePostsByYear(posts),
    [posts],
  );

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const activeYear =
    selectedYear !== null && years.includes(selectedYear)
      ? selectedYear
      : years[0] ?? new Date().getFullYear();

  const weeks = useMemo(
    () =>
      buildHeatmapWeeks(
        activeYear,
        countsByYear.get(activeYear),
        rangesByYear.get(activeYear),
      ),
    [activeYear, countsByYear, rangesByYear],
  );

  const monthForWeek = useMemo(() => monthLabelsForWeeks(weeks), [weeks]);
  const total = totalsByYear.get(activeYear) ?? 0;

  if (posts.length === 0) {
    return null;
  }

  return (
    <div className="streak-block">
      <div className="streak-head">
        <span className="streak-total">
          {total} {total === 1 ? "post" : "posts"} in {activeYear}
        </span>
        <div className="streak-years" role="tablist" aria-label="Select year">
          {years.map((year) => (
            <button
              key={year}
              type="button"
              role="tab"
              aria-selected={year === activeYear}
              className={cn(year === activeYear && "active")}
              onClick={() => setSelectedYear(year)}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      <div className="heatmap-cal">
        <div className="heatmap-scroll">
          <div className="heatmap-months">
            {monthForWeek.map((label, index) => (
              <span key={index} className="heatmap-month">
                {label ?? ""}
              </span>
            ))}
          </div>

          <div className="heatmap-grid-row">
            <div className="heatmap-weekdays" aria-hidden="true">
              {WEEKDAY_LABELS.map((label, index) => (
                <span key={index}>{label}</span>
              ))}
            </div>

            <div
              className="heatmap"
              role="img"
              aria-label={`Posting activity in ${activeYear}`}
            >
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="heatmap-week">
                  {week.map((day) => (
                    <span
                      key={day.key}
                      className={cn(
                        "heatmap-cell",
                        !day.inYear
                          ? "empty"
                          : day.future
                            ? "future"
                            : `lvl-${activityLevel(day.count)}`,
                      )}
                      title={
                        day.inYear && !day.future
                          ? `${day.count} ${
                              day.count === 1 ? "post" : "posts"
                            } · ${day.date.toLocaleDateString()}`
                          : undefined
                      }
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="heatmap-legend">
          <span>Less</span>
          <span className="heatmap-cell lvl-0" />
          <span className="heatmap-cell lvl-1" />
          <span className="heatmap-cell lvl-2" />
          <span className="heatmap-cell lvl-3" />
          <span className="heatmap-cell lvl-4" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
