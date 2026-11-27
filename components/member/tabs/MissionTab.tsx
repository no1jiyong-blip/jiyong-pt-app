"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Homework, Session } from "@/lib/types";
import { getWeekStartISO, parseHomeworkCategory } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { TabHeader } from "@/components/member/TabHeader";
import { PastMissionsSection } from "@/components/member/PastMissionsSection";

interface Props {
  /** 회원의 전체 숙제 기록 (이번 주 + 과거 주차 전부 포함) */
  homework: Homework[];
  /** 주차별 "당시 트레이너 피드백"을 실제 PT 세션 기록에서 찾기 위해 필요 */
  sessions: Session[];
  onUpdate: () => void;
}

const parseCategory = parseHomeworkCategory;

export function MissionTab({ homework, sessions, onUpdate }: Props) {
  const [items, setItems] = useState(homework);
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

      {/* ─── 이번 주 미션 요약 (결론 우선) ─── */}
      <div className="pt-card flex flex-col gap-3" style={{ padding: 20 }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-cond text-ink-3">이번 주 미션</span>
          <span className="text-xs font-cond font-bold text-ink-2 tabular-nums">
            {completedCount}/{totalCount} 완료 · {pct}%
          </span>
        </div>
        <h1 className="font-display text-ink-0 leading-snug" style={{ fontSize: 21 }}>
          {totalCount === 0 ? (
            "이번 주 등록된 숙제가 없습니다"
          ) : allCompleted ? (
            <>
              이번 주 숙제를 <span className="text-volt">모두 끝냈어요</span>
            </>
          ) : (
            <>
              이번 주 숙제{" "}
              <span className="text-volt tabular-nums">{totalCount - completedCount}개</span>만 더 하면
              100%예요
            </>
          )}
        </h1>
        {totalCount > 0 && (
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
        )}
      </div>

      {/* ─── 이주의 숙제 (개별 행 배치, 감싸는 카드 없음) ─── */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-cond font-bold text-ink-0" style={{ fontSize: 17 }}>
            이주의 숙제
          </h2>
          <span className="text-xs font-cond text-ink-3">터치해서 완료 체크</span>
        </div>

        {totalCount > 0 ? (
          <div className="flex flex-col gap-2.5">
            {currentItems.map((hw) => {
              const { category, text } = parseCategory(hw.content);
              return (
                <button
                  key={hw.id}
                  onClick={() => toggle(hw)}
                  className="tap-haptic w-full text-left rounded-2xl p-4 flex items-start gap-3.5 transition-colors"
                  style={
                    hw.is_completed
                      ? { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }
                      : { background: "var(--pt-2)", border: "1px solid var(--pt-5)" }
                  }
                >
                  <span
                    className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors"
                    style={
                      hw.is_completed
                        ? { background: "var(--volt)" }
                        : { border: "1px solid var(--pt-6)", background: "transparent" }
                    }
                  >
                    {hw.is_completed && <Check size={13} strokeWidth={3} color="#000" />}
                  </span>
                  <span className="min-w-0 flex-1 flex flex-col gap-1">
                    {category && (
                      <span
                        className="inline-block w-fit text-[11px] font-cond font-bold px-2 py-0.5 rounded leading-none"
                        style={{ background: "rgba(255,255,255,0.06)", color: "var(--ink-3)" }}
                      >
                        {category}
                      </span>
                    )}
                    <span
                      className={cn(
                        "text-sm font-cond font-semibold leading-snug",
                        hw.is_completed ? "text-ink-3 line-through" : "text-ink-0"
                      )}
                    >
                      {text}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-ink-3 text-sm font-cond text-center py-4">
            이번 주 등록된 숙제가 없습니다
          </p>
        )}
      </section>

      {/* ─── 이전 숙제 내역 (별도 컴포넌트 — 추후 아카이브 화면에도 재사용 가능) ─── */}
      <PastMissionsSection homework={items} sessions={sessions} />
    </div>
  );
}
