"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, MessageSquareQuote } from "lucide-react";
import type { Homework, Session } from "@/lib/types";
import { cn, formatWeekRange, getWeekStartISO, parseHomeworkCategory } from "@/lib/utils";

interface WeekGroup {
  weekStart: string;
  items: Homework[];
  completed: number;
  total: number;
  pct: number;
  rangeLabel: string;
  weekLabel: string;
  monthLabel: string;
  /** 그 주간 실제 PT 세션에 남겨진 트레이너 메모 (없으면 null — 지어내지 않음) */
  feedback: string | null;
}

interface Props {
  /** 회원의 전체 숙제 기록 (DB homework 테이블 그대로) */
  homework: Homework[];
  /** 주차별 "당시 트레이너 피드백"을 실제 PT 세션 기록에서 찾기 위해 필요 */
  sessions: Session[];
  /** 이 주차는 "이전 기록"에서 제외 (기본: 이번 주). 아카이브 화면 등에서 전체를 보여주려면 빈 문자열을 넘기면 됨 */
  excludeWeekStart?: string;
  /** 월 필터 탭에 보여줄 최근 개월 수 — 너무 길어지지 않도록 최근 개월 위주로만 노출 */
  maxMonths?: number;
}

/**
 * 과거 주차 숙제 수행 이력 — 향후 "메뉴 > 이전 기록 > 숙제 기록" 같은
 * 별도 아카이브 화면으로도 그대로 옮겨 쓸 수 있도록 homework/sessions
 * 원본 데이터만 받아서 자체적으로 집계하는 독립 컴포넌트.
 */
export function PastMissionsSection({
  homework,
  sessions,
  excludeWeekStart,
  maxMonths = 6,
}: Props) {
  const weekStart = excludeWeekStart ?? getWeekStartISO();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  const pastWeeks: WeekGroup[] = useMemo(() => {
    const map = new Map<string, Homework[]>();
    homework.forEach((h) => {
      if (h.week_start === weekStart) return;
      if (!map.has(h.week_start)) map.set(h.week_start, []);
      map.get(h.week_start)!.push(h);
    });
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([ws, list]) => {
        const completed = list.filter((h) => h.is_completed).length;
        const total = list.length;
        const { rangeLabel, weekLabel, monthLabel } = formatWeekRange(ws);

        // 그 주(월~일) 사이에 실제로 진행된 PT 세션 중 트레이너 메모가 있는 걸 찾음 (없으면 null)
        const weekEnd = new Date(`${ws}T00:00:00`);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekEndStr = weekEnd.toISOString().slice(0, 10);
        const noteSession = sessions
          .filter((s) => s.date >= ws && s.date <= weekEndStr && s.trainer_note && s.trainer_note.trim())
          .sort((a, b) => b.date.localeCompare(a.date))[0];

        return {
          weekStart: ws,
          items: list,
          completed,
          total,
          pct: total > 0 ? Math.round((completed / total) * 100) : 0,
          rangeLabel,
          weekLabel,
          monthLabel,
          feedback: noteSession?.trainer_note ?? null,
        };
      });
  }, [homework, sessions, weekStart]);

  /* 과거 주차가 걸쳐 있는 월 목록 (최신순) — 최근 개월 위주로만 노출 */
  const availableMonths = useMemo(() => {
    const seen = new Set<string>();
    const months: string[] = [];
    pastWeeks.forEach((w) => {
      if (!seen.has(w.monthLabel)) {
        seen.add(w.monthLabel);
        months.push(w.monthLabel);
      }
    });
    return months.slice(0, maxMonths);
  }, [pastWeeks, maxMonths]);

  const effectiveMonth =
    selectedMonth && availableMonths.includes(selectedMonth) ? selectedMonth : availableMonths[0] ?? null;

  const filteredPastWeeks = useMemo(
    () => pastWeeks.filter((w) => w.monthLabel === effectiveMonth),
    [pastWeeks, effectiveMonth]
  );

  if (pastWeeks.length === 0) return null;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-cond font-bold text-ink-0" style={{ fontSize: 17 }}>
          이전 숙제 내역
        </h2>
        {availableMonths.length > 1 && (
          <div
            className="flex items-center gap-1 p-1 rounded-full shrink-0 overflow-x-auto"
            style={{ background: "rgba(0,0,0,0.4)", border: "1px solid var(--pt-5)", scrollbarWidth: "none" }}
          >
            {availableMonths.map((m) => {
              const active = effectiveMonth === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setSelectedMonth(m);
                    setExpandedWeek(null);
                  }}
                  className="tap-haptic px-3 py-1 rounded-full text-xs font-cond font-bold transition-all shrink-0"
                  style={
                    active
                      ? { background: "var(--volt)", color: "#000" }
                      : { color: "var(--ink-3)" }
                  }
                >
                  {m}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-card flex flex-col" style={{ padding: 0 }}>
        {filteredPastWeeks.map((w, idx) => {
          const isExpanded = expandedWeek === w.weekStart;
          return (
            <div
              key={w.weekStart}
              style={
                idx < filteredPastWeeks.length - 1
                  ? { borderBottom: "1px solid rgba(255,255,255,0.06)" }
                  : undefined
              }
            >
              <button
                type="button"
                onClick={() => setExpandedWeek(isExpanded ? null : w.weekStart)}
                className="tap-haptic w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-bold text-ink-0">{w.weekLabel}</span>
                  <span className="text-xs font-cond text-ink-3 tabular-nums">{w.rangeLabel}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="text-xs font-cond font-bold tabular-nums"
                    style={{ color: w.pct === 100 ? "var(--volt)" : "var(--ink-2)" }}
                  >
                    {w.completed}/{w.total} 완료
                  </span>
                  {isExpanded ? (
                    <ChevronUp size={16} className="text-ink-3" />
                  ) : (
                    <ChevronDown size={16} className="text-ink-3" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div
                  className="px-4 pb-4 pt-1 flex flex-col gap-3"
                  style={{ background: "rgba(0,0,0,0.3)" }}
                >
                  <div className="flex flex-col gap-2">
                    {w.items.map((hw) => {
                      const { category, text } = parseHomeworkCategory(hw.content);
                      return (
                        <div
                          key={hw.id}
                          className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-xs"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-4 h-4 rounded-md flex items-center justify-center shrink-0"
                              style={{
                                background: hw.is_completed ? "var(--volt)" : "transparent",
                                border: hw.is_completed ? "none" : "1px solid var(--pt-6)",
                              }}
                            >
                              {hw.is_completed && <Check size={11} strokeWidth={3} color="#000" />}
                            </div>
                            <span className="min-w-0 leading-relaxed">
                              {category && (
                                <span className="text-ink-4 font-cond mr-1">[{category}]</span>
                              )}
                              <span
                                className={cn(
                                  "font-medium",
                                  hw.is_completed ? "text-ink-2" : "text-ink-4 line-through"
                                )}
                              >
                                {text}
                              </span>
                            </span>
                          </div>
                          <span
                            className="font-cond font-bold shrink-0"
                            style={{ color: hw.is_completed ? "var(--volt)" : "var(--ink-4)" }}
                          >
                            {hw.is_completed ? "완료" : "미완료"}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {w.feedback && (
                    <div
                      className="rounded-xl p-3.5"
                      style={{ background: "rgba(211,255,82,0.04)", border: "1px solid var(--volt-glow-2)" }}
                    >
                      <div className="flex items-center gap-1.5 mb-1" style={{ color: "var(--volt)" }}>
                        <MessageSquareQuote size={13} />
                        <span className="text-[11px] font-cond font-bold">당시 트레이너 피드백</span>
                      </div>
                      <p className="text-xs text-ink-2 leading-relaxed">&ldquo;{w.feedback}&rdquo;</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
