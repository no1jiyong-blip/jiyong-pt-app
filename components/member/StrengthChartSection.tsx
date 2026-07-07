"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  EXERCISE_GROUPS,
  EXERCISE_GROUP_LABELS,
  type ExerciseGroupKey,
  type Session,
  type ExerciseRecord,
  calcOneRM,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  sessions: Session[];
  exerciseRecordsBySession: Record<string, ExerciseRecord[]>;
}

/* Slate-toned cohesive palette (chart 1-5) — main exercise gets volt */
const SLATE_PALETTE = [
  "#D3FF52", // 1st = volt (primary)
  "#cbd5e1", // slate-300
  "#94a3b8", // slate-400
  "#64748b", // slate-500
  "#475569", // slate-600
  "#334155", // slate-700
];

export function StrengthChartSection({
  sessions,
  exerciseRecordsBySession,
}: Props) {
  const [tab, setTab] = useState<ExerciseGroupKey>("big3");
  const exercises = EXERCISE_GROUPS[tab];

  const chartData = useMemo(() => {
    const completed = sessions
      .filter((s) => s.status === "completed")
      .sort((a, b) => a.date.localeCompare(b.date));

    return completed.flatMap((s) => {
      const records = exerciseRecordsBySession[s.id] ?? [];
      const dateLabel = `${s.date.slice(5, 7)}/${s.date.slice(8, 10)}`;
      const point: Record<string, string | number> = { date: dateLabel };
      let hasAny = false;
      for (const ex of exercises) {
        const matching = records.filter((r) => r.exercise_name === ex);
        if (matching.length === 0) continue;
        const maxORM = Math.max(
          ...matching.map((r) => calcOneRM(r.weight ?? 0, r.reps ?? 0))
        );
        if (maxORM > 0) {
          point[ex] = maxORM;
          hasAny = true;
        }
      }
      return hasAny ? [point] : [];
    });
  }, [sessions, exerciseRecordsBySession, exercises]);

  return (
    <section className="px-6 flex flex-col gap-5">
      <h2 className="section-title">
        <span className="section-bar-blue"></span>
        근력 변화 추이
      </h2>

      <div className="pt-card flex flex-col gap-7">
        {/* Tabs */}
        <div className="flex gap-2 p-1.5 rounded-xl bg-pt-2 border border-pt-5">
          {(Object.keys(EXERCISE_GROUPS) as ExerciseGroupKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "flex-1 py-3 rounded-lg font-cond font-bold text-sm tracking-wider leading-none transition-all",
                tab === k ? "bg-volt text-black glow-volt" : "text-ink-2"
              )}
            >
              {EXERCISE_GROUP_LABELS[k]}
            </button>
          ))}
        </div>

        {/* Y axis label row */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-3 font-cond leading-none tracking-wider uppercase">
            1RM 추정치
          </p>
          <p className="text-xs text-volt font-cond font-bold leading-none">
            KG
          </p>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 14, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1c" />
              <XAxis
                dataKey="date"
                tick={{
                  fill: "#666",
                  fontSize: 11,
                  fontFamily: "Barlow Condensed",
                }}
              />
              <YAxis
                tick={{
                  fill: "#666",
                  fontSize: 11,
                  fontFamily: "Barlow Condensed",
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0a0a0a",
                  border: "1px solid var(--volt)",
                  borderRadius: 10,
                  fontFamily: "Barlow Condensed",
                  fontSize: 12,
                  padding: "10px 14px",
                }}
                labelStyle={{ color: "#999", marginBottom: 6 }}
              />
              {exercises.map((ex, i) => (
                <Line
                  key={ex}
                  type="monotone"
                  dataKey={ex}
                  stroke={SLATE_PALETTE[i] ?? "#94a3b8"}
                  strokeWidth={i === 0 ? 3 : 2}
                  dot={{
                    fill: SLATE_PALETTE[i] ?? "#94a3b8",
                    r: i === 0 ? 5 : 4,
                  }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-44 flex items-center justify-center border border-dashed border-pt-5 rounded-xl">
            <p className="text-ink-3 font-cond text-sm">
              아직 운동 기록이 없습니다
            </p>
          </div>
        )}

        {/* Legend */}
        {chartData.length > 0 && (
          <div className="flex flex-wrap gap-x-5 gap-y-3 pt-5 border-t border-pt-5">
            {exercises.map((ex, i) => (
              <div key={ex} className="flex items-center gap-2.5">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: SLATE_PALETTE[i],
                    boxShadow:
                      i === 0 ? `0 0 8px ${SLATE_PALETTE[i]}` : undefined,
                  }}
                />
                <span
                  className={cn(
                    "text-xs font-cond leading-none",
                    i === 0 ? "text-volt font-bold" : "text-ink-2"
                  )}
                >
                  {ex}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
