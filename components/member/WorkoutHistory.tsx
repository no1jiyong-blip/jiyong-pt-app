"use client";

import { useState, useMemo } from "react";
import { CheckCircle2, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { cn, formatShortKoreanDate } from "@/lib/utils";
import type { Session, ExerciseRecord } from "@/lib/types";

interface Props {
  sessions: Session[];
  exerciseRecordsBySession: Record<string, ExerciseRecord[]>;
}

type Filter = "week" | "month" | "all";

export function WorkoutHistory({
  sessions,
  exerciseRecordsBySession,
}: Props) {
  const [filter, setFilter] = useState<Filter>("week");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const now = Date.now();
    const limits: Record<Filter, number> = {
      week: 7 * 86400000,
      month: 30 * 86400000,
      all: Infinity,
    };
    const limit = limits[filter];
    return [...sessions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((s) => {
        if (filter === "all") return true;
        const t = new Date(s.date).getTime();
        return Math.abs(now - t) <= limit;
      });
  }, [sessions, filter]);

  return (
    <section className="px-6 flex flex-col gap-5">
      <h2 className="section-title">
        <span className="section-bar"></span>
        운동 기록
      </h2>

      <div className="flex gap-2.5">
        {(["week", "month", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn("tab-pill", filter === f && "tab-pill-active")}
          >
            {f === "week" ? "이번 주" : f === "month" ? "이번 달" : "전체"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="pt-card text-center">
          <p className="text-ink-3 font-cond">기록이 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((s) => {
            const records = exerciseRecordsBySession[s.id] ?? [];
            const summary =
              records.length > 0
                ? records.map((r) => r.exercise_name).join(", ")
                : s.title || "운동 기록 없음";
            const isOpen = openId === s.id;
            const isCompleted = s.status === "completed";

            return (
              <div
                key={s.id}
                className="rounded-3xl overflow-hidden transition-colors"
                style={{
                  background: "var(--grad-card-dark)",
                  border: isOpen
                    ? "1px solid var(--volt-glow-2)"
                    : "1px solid var(--pt-5)",
                }}
              >
                <button
                  onClick={() => setOpenId(isOpen ? null : s.id)}
                  className="w-full flex items-center gap-4 p-6 text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-pt-4 flex items-center justify-center font-display text-ink-1 text-base shrink-0 leading-none">
                    {s.session_number ?? "—"}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <p className="text-ink-2 text-xs font-cond leading-none">
                      {formatShortKoreanDate(s.date)}
                      {s.time && (
                        <span className="ml-2 text-ink-3">{s.time}</span>
                      )}
                    </p>
                    <p className="font-cond font-bold text-ink-0 text-sm truncate leading-tight">
                      {summary}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isCompleted ? (
                      <span className="flex items-center gap-1.5 text-volt text-xs font-cond font-bold">
                        <CheckCircle2 size={14} />
                        완료
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-ink-2 text-xs font-cond">
                        <Clock size={14} />
                        예정
                      </span>
                    )}
                    {isOpen ? (
                      <ChevronUp size={16} className="text-ink-3" />
                    ) : (
                      <ChevronDown size={16} className="text-ink-3" />
                    )}
                  </div>
                </button>

                {isOpen && records.length > 0 && (
                  <div className="px-6 pb-6 border-t border-pt-5 pt-5 flex flex-col gap-2.5 anim-fade-slide">
                    {records.map((r) => (
                      <div
                        key={r.id}
                        className="bg-pt-2 rounded-xl p-4 flex items-center justify-between gap-3"
                      >
                        <span className="font-cond font-bold text-ink-0 text-sm">
                          {r.exercise_name}
                        </span>
                        <span className="text-xs text-ink-2 font-cond shrink-0">
                          {r.sets ?? 0}세트 × {r.reps ?? 0}회
                          {r.weight ? ` @ ${r.weight}kg` : ""}
                        </span>
                      </div>
                    ))}
                    {s.feedback && (
                      <div
                        className="rounded-xl p-5 flex flex-col gap-2 mt-2 border"
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(211,255,82,0.08) 0%, transparent 100%)",
                          borderColor: "var(--volt-glow-2)",
                        }}
                      >
                        <p className="text-xs text-volt font-cond font-bold leading-none uppercase tracking-wider">
                          피드백
                        </p>
                        <p className="text-sm text-ink-1 leading-relaxed">
                          {s.feedback}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
