"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, MessageSquare, MessageSquareQuote, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Homework, Session } from "@/lib/types";
import { getWeekStartISO } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { TabHeader } from "@/components/member/TabHeader";

interface Props {
  /** 회원의 전체 숙제 기록 (이번 주 + 과거 주차 전부 포함) */
  homework: Homework[];
  /** 주차별 "당시 트레이너 피드백"을 실제 PT 세션 기록에서 찾기 위해 필요 */
  sessions: Session[];
  trainerNote?: string | null;
  onUpdate: () => void;
}

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

/** "[카테고리] 내용" 형식이면 분리, 아니면 전체를 본문으로 취급 */
function parseCategory(content: string): { category: string | null; text: string } {
  const m = content.match(/^\[(.+?)\]\s*(.*)$/);
  return m ? { category: m[1], text: m[2] } : { category: null, text: content };
}

/** 주 시작일(월요일) 기준으로 "YYYY.MM.DD ~ MM.DD" 범위와 "M월 N주차" 라벨 생성 */
function formatWeekRange(weekStartISO: string) {
  const monday = new Date(`${weekStartISO}T00:00:00`);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const pad = (n: number) => String(n).padStart(2, "0");
  const rangeLabel = `${pad(monday.getMonth() + 1)}.${pad(monday.getDate())} ~ ${pad(
    sunday.getMonth() + 1
  )}.${pad(sunday.getDate())}`;
  const monthLabel = `${sunday.getMonth() + 1}월`;
  const weekLabel = `${monthLabel} ${Math.ceil(sunday.getDate() / 7)}주차`;
  return { rangeLabel, weekLabel, monthLabel };
}

export function MissionTab({ homework, sessions, trainerNote, onUpdate }: Props) {
  const [items, setItems] = useState(homework);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const weekStart = getWeekStartISO();

  useEffect(() => setItems(homework), [homework]);

  const currentItems = useMemo(
    () => items.filter((h) => h.week_start === weekStart),
    [items, weekStart]
  );
  const completedCount = currentItems.filter((h) => h.is_completed).length;
  const totalCount = currentItems.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allCompleted = totalCount > 0 && completedCount === totalCount;

  /* 이번 주를 제외한 과거 주차별 그룹 (최신순) */
  const pastWeeks: WeekGroup[] = useMemo(() => {
    const map = new Map<string, Homework[]>();
    items.forEach((h) => {
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
  }, [items, sessions, weekStart]);

  /* 과거 주차가 걸쳐 있는 월 목록 (최신순) — PAST MISSIONS 월별 필터 탭 */
  const availableMonths = useMemo(() => {
    const seen = new Set<string>();
    const months: string[] = [];
    pastWeeks.forEach((w) => {
      if (!seen.has(w.monthLabel)) {
        seen.add(w.monthLabel);
        months.push(w.monthLabel);
      }
    });
    return months;
  }, [pastWeeks]);

  const effectiveMonth =
    selectedMonth && availableMonths.includes(selectedMonth) ? selectedMonth : availableMonths[0] ?? null;

  const filteredPastWeeks = useMemo(
    () => pastWeeks.filter((w) => w.monthLabel === effectiveMonth),
    [pastWeeks, effectiveMonth]
  );

  /* 연속 80% 이상 달성 스트릭 — 가장 최근 과거 주차부터 역순으로, 끊김 없이 이어진 주만 카운트 */
  const streak = useMemo(() => {
    let count = 0;
    for (let i = 0; i < pastWeeks.length; i++) {
      const w = pastWeeks[i];
      if (w.total === 0 || w.pct < 80) break;
      if (i > 0) {
        const prevMonday = new Date(`${pastWeeks[i - 1].weekStart}T00:00:00`);
        const thisMonday = new Date(`${w.weekStart}T00:00:00`);
        const diffDays = Math.round((prevMonday.getTime() - thisMonday.getTime()) / 86400000);
        if (diffDays !== 7) break;
      }
      count++;
    }
    return count;
  }, [pastWeeks]);

  const toggle = async (hw: Homework) => {
    const newVal = !hw.is_completed;
    setItems((prev) =>
      prev.map((h) => (h.id === hw.id ? { ...h, is_completed: newVal } : h))
    );
    const { error } = await supabase
      .from("homework")
      .update({ is_completed: newVal })
      .eq("id", hw.id);
    if (error) {
      setItems((prev) =>
        prev.map((h) => (h.id === hw.id ? { ...h, is_completed: !newVal } : h))
      );
    } else {
      onUpdate();
    }
  };

  return (
    <div className="anim-tab-slide flex flex-col gap-8 px-6 pt-2 pb-36">
      {/* ─── 헤더 ─── */}
      <TabHeader
        title="WEEKLY MISSION"
        subtitle="꾸준한 작은 습관이 큰 변화를 만듭니다"
      />

      {/* ─── 이주의 숙제 ─── */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="section-title">
            <span className="section-bar"></span>
            이주의 숙제
          </h2>
          {streak >= 1 && (
            <span
              className="px-3 py-1.5 rounded-full font-cond font-bold text-xs tracking-wider leading-none shrink-0"
              style={{
                background: "rgba(211,255,82,0.12)",
                color: "var(--volt)",
                border: "1px solid var(--volt-glow-2)",
              }}
            >
              🔥 {streak}주 연속 80% 달성
            </span>
          )}
        </div>

        <div
          className={cn(
            "pt-card-xl flex flex-col gap-5",
            allCompleted && "anim-shimmer-border"
          )}
          style={
            allCompleted
              ? { borderColor: "var(--volt)", background: "var(--grad-card-hot)" }
              : undefined
          }
        >
          {totalCount > 0 ? (
            <>
              {/* 통합 달성률 게이지 */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-end justify-between gap-3">
                  <p className="font-display text-volt text-3xl tracking-wider leading-none">
                    {completedCount}
                    <span className="text-ink-3 text-base ml-1">
                      / {totalCount} 완료
                    </span>
                  </p>
                  {allCompleted ? (
                    <span
                      className="px-3 py-1.5 rounded-full font-cond font-bold text-xs tracking-wider leading-none"
                      style={{
                        background: "var(--grad-volt)",
                        color: "#000",
                        boxShadow: "0 0 12px var(--volt-glow-2)",
                      }}
                    >
                      🔥 모두 완료!
                    </span>
                  ) : (
                    <span
                      className="font-mono-num font-extrabold text-lg leading-none"
                      style={{ color: "var(--volt)" }}
                    >
                      {pct}%
                    </span>
                  )}
                </div>
                <div
                  className="w-full rounded-full overflow-hidden"
                  style={{ height: 8, background: "var(--pt-4)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: "var(--volt)",
                      boxShadow: "0 0 8px var(--volt-glow-2)",
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {currentItems.map((hw) => {
                  const { category, text } = parseCategory(hw.content);
                  return (
                    <button
                      key={hw.id}
                      onClick={() => toggle(hw)}
                      className={cn(
                        "tap-haptic w-full flex items-center gap-4 p-5 rounded-2xl border transition-all text-left",
                        hw.is_completed
                          ? "anim-shimmer-border"
                          : "bg-pt-2 border-pt-5 hover:border-pt-6"
                      )}
                      style={
                        hw.is_completed
                          ? {
                              background: "var(--grad-card-hot)",
                              borderColor: "var(--volt-glow-2)",
                            }
                          : undefined
                      }
                    >
                      <div
                        className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-all",
                          hw.is_completed
                            ? "border-volt"
                            : "border-pt-6 bg-transparent"
                        )}
                        style={{
                          background: hw.is_completed
                            ? "var(--grad-volt)"
                            : undefined,
                        }}
                      >
                        {hw.is_completed && (
                          <Check size={15} strokeWidth={3} color="#000" />
                        )}
                      </div>
                      <span className="flex-1 flex flex-col gap-1 min-w-0">
                        {category && (
                          <span
                            className="text-[10px] font-cond font-bold uppercase tracking-wider leading-none w-fit px-1.5 py-0.5 rounded"
                            style={{
                              background: hw.is_completed ? "rgba(211,255,82,0.15)" : "var(--pt-3)",
                              color: hw.is_completed ? "var(--volt)" : "var(--ink-3)",
                            }}
                          >
                            {category}
                          </span>
                        )}
                        <span
                          className={cn(
                            "text-sm leading-relaxed",
                            hw.is_completed
                              ? "text-ink-3 line-through"
                              : "text-ink-0"
                          )}
                        >
                          {text}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-ink-3 text-sm font-cond text-center py-4">
              이번 주 등록된 숙제가 없습니다
            </p>
          )}

          {trainerNote && (
            <div
              className="rounded-2xl p-5 border-2 flex flex-col gap-3 mt-2"
              style={{
                background:
                  "linear-gradient(135deg, rgba(211,255,82,0.10) 0%, rgba(211,255,82,0.02) 100%)",
                borderColor: "var(--volt-glow-2)",
              }}
            >
              <div className="flex items-center gap-2">
                <MessageSquare size={14} className="text-volt" />
                <p className="text-xs font-cond font-bold text-volt tracking-wider leading-none">
                  트레이너 메모
                </p>
              </div>
              <p className="text-ink-1 text-sm leading-relaxed">
                {trainerNote}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ─── 이전 숙제 내역 ─── */}
      {pastWeeks.length > 0 && (
        <section className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="section-title">
              <span className="section-bar"></span>
              이전 숙제 내역
            </h2>
            {availableMonths.length > 1 && (
              <div
                className="flex items-center gap-1 p-1 rounded-full shrink-0"
                style={{ background: "rgba(0,0,0,0.4)", border: "1px solid var(--pt-5)" }}
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
                      className="tap-haptic px-3 py-1 rounded-full text-xs font-cond font-bold transition-all"
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

          <div className="flex flex-col gap-3">
            {filteredPastWeeks.map((w) => {
              const isExpanded = expandedWeek === w.weekStart;
              return (
                <div
                  key={w.weekStart}
                  className="pt-card flex flex-col gap-3"
                  style={{ padding: 18 }}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedWeek(isExpanded ? null : w.weekStart)}
                    className="tap-haptic w-full flex items-center justify-between gap-3 text-left"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-sm font-bold text-ink-0">
                        {w.rangeLabel}{" "}
                        <span className="text-ink-3 font-cond text-xs">
                          ({w.weekLabel})
                        </span>
                      </span>
                      <span className="text-xs font-cond text-ink-3">
                        {w.completed}/{w.total} 완료 · {w.pct}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="font-mono-num font-bold text-xs px-2 py-1 rounded-full"
                        style={{
                          background:
                            w.pct === 100
                              ? "rgba(211,255,82,0.12)"
                              : "rgba(255,255,255,0.05)",
                          color: w.pct === 100 ? "var(--volt)" : "var(--ink-2)",
                          border: `1px solid ${
                            w.pct === 100 ? "var(--volt-glow-2)" : "var(--pt-5)"
                          }`,
                        }}
                      >
                        {w.pct}%
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
                      className="flex flex-col gap-3 pt-3"
                      style={{ borderTop: "1px solid var(--pt-5)" }}
                    >
                      <div className="flex flex-col gap-2">
                        {w.items.map((hw) => {
                          const { category, text } = parseCategory(hw.content);
                          return (
                            <div
                              key={hw.id}
                              className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-xs"
                              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}
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
      )}
    </div>
  );
}
