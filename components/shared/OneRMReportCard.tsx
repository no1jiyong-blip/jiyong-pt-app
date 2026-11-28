"use client";

import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import type { Session, ExerciseRecord } from "@/lib/types";
import { calcOneRM } from "@/lib/types";

const VOLT = "#D3FF52";
const VOLT_GLOW = "rgba(211,255,82,0.5)";

interface Props {
  exerciseName: string;
  sessions: Session[];
  recordsBySession: Record<string, ExerciseRecord[]>;
  /** 등록 첫 세션 기준으로 총 성장 계산 */
  startDate?: string | null;
  /** true면 바깥 pt-card 래퍼 없이 내용만 렌더링 (다른 카드 안에 중첩할 때) */
  bare?: boolean;
  /** ACSM 벤치마크 기준 다음 등급 목표 중량 — 있으면 목표 기준선 표시 */
  goalKg?: number;
}

interface PRPoint {
  date: string;
  weight: number;
  reps: number;
  orm: number;
  sessionTitle: string | null;
}

export function OneRMReportCard({
  exerciseName,
  sessions,
  recordsBySession,
  bare = false,
  goalKg,
}: Props) {
  const [prOpen, setPrOpen] = useState(false);

  const { latest, previous, first, allPRs, totalGrowthKg, totalGrowthPct } =
    useMemo(() => {
      const completed = sessions
        .filter((s) => s.status === "completed")
        .sort((a, b) => a.date.localeCompare(b.date));

      const prPoints: PRPoint[] = [];
      let prevMax = 0;

      completed.forEach((s) => {
        const recs = (recordsBySession[s.id] ?? []).filter(
          (r) => r.exercise_name === exerciseName
        );
        if (recs.length === 0) return;

        // 해당 세션의 최고 1RM 세트 찾기
        let bestRec: ExerciseRecord | null = null;
        let bestORM = 0;
        recs.forEach((r) => {
          const orm = calcOneRM(r.weight ?? 0, r.reps ?? 0);
          if (orm > bestORM) {
            bestORM = orm;
            bestRec = r;
          }
        });

        if (!bestRec || bestORM <= 0) return;

        if (bestORM > prevMax) {
          prevMax = bestORM;
          prPoints.push({
            date: s.date,
            weight: (bestRec as ExerciseRecord).weight ?? 0,
            reps: (bestRec as ExerciseRecord).reps ?? 0,
            orm: Math.round(bestORM),
            sessionTitle: s.title,
          });
        }
      });

      const latest = prPoints[prPoints.length - 1] ?? null;
      const previous = prPoints[prPoints.length - 2] ?? null;
      const first = prPoints[0] ?? null;

      const totalGrowthKg =
        latest && first ? latest.orm - first.orm : 0;
      const totalGrowthPct =
        first && first.orm > 0
          ? Math.round(((totalGrowthKg) / first.orm) * 100 * 10) / 10
          : 0;

      return {
        latest,
        previous,
        first,
        allPRs: prPoints,
        totalGrowthKg,
        totalGrowthPct,
      };
    }, [sessions, recordsBySession, exerciseName]);

  if (!latest) return null;

  const prevChangePct =
    previous && previous.orm > 0
      ? Math.round(((latest.orm - previous.orm) / previous.orm) * 100 * 10) /
        10
      : null;
  const isUp = prevChangePct !== null && prevChangePct >= 0;

  const monthDay = (d: string) =>
    `${parseInt(d.slice(5, 7))}월 ${parseInt(d.slice(8, 10))}일`;

  return (
    <div
      className={bare ? "flex flex-col gap-5" : "pt-card flex flex-col gap-5 anim-fade-slide"}
      style={
        bare
          ? undefined
          : {
              padding: 22,
              background: "linear-gradient(160deg, rgba(211,255,82,0.06) 0%, rgba(20,20,20,0.88) 65%)",
              borderColor: "rgba(211,255,82,0.2)",
            }
      }
    >
      {/* 헤더 (bare일 때는 상위 카드가 이미 종목명을 표시하므로 생략) */}
      {!bare && (
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-cond font-bold leading-none" style={{ color: "var(--ink-0)", fontSize: 14 }}>
            {exerciseName}
          </p>
          {prevChangePct !== null && (
            <span
              className="flex items-center gap-1 text-[11px] font-cond font-bold leading-none tabular-nums"
              style={{ color: isUp ? VOLT : "var(--ink-3)" }}
            >
              {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {isUp ? "+" : ""}
              {prevChangePct}%
            </span>
          )}
        </div>
      )}

      {/* 현재 1RM 대형 표시 */}
      <div className="flex flex-col gap-2">
        <p
          className="font-display tabular-nums leading-none"
          style={{
            fontSize: 54,
            color: VOLT,
            textShadow: `0 0 20px ${VOLT_GLOW}`,
            letterSpacing: "-0.025em",
          }}
        >
          {latest.orm}
          <span className="text-ink-3 text-base ml-2">kg</span>
        </p>
        <p className="text-[11px] text-ink-3 font-cond leading-none">
          추정 1RM (Brzycki 공식)
        </p>
      </div>

      {/* 핵심 수치: 누적 증량 · 목표 기준선 */}
      {first && allPRs.length >= 2 && (
        <div className={`grid gap-2.5 ${goalKg && goalKg > first.orm ? "grid-cols-2" : "grid-cols-1"}`}>
          <div className="rounded-2xl p-3.5" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--pt-5)" }}>
            <p className="text-[10px] font-cond text-ink-3 leading-none mb-1.5">누적 증량</p>
            <div className="flex items-baseline gap-1">
              <span className="font-mono-num font-extrabold tabular-nums" style={{ fontSize: 20, color: VOLT }}>
                +{totalGrowthKg}
              </span>
              <span className="text-[11px] font-cond font-bold text-ink-3">kg</span>
              <span className="text-[10px] font-cond font-bold text-ink-4 ml-1 tabular-nums">
                (+{totalGrowthPct}%)
              </span>
            </div>
          </div>
          {goalKg && goalKg > first.orm && (
            <div className="rounded-2xl p-3.5" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--pt-5)" }}>
              <p className="text-[10px] font-cond text-ink-3 leading-none mb-1.5">목표 기준선</p>
              <div className="flex items-baseline gap-1">
                <span className="font-mono-num font-extrabold tabular-nums" style={{ fontSize: 20, color: "var(--ink-0)" }}>
                  {goalKg}
                </span>
                <span className="text-[11px] font-cond font-bold text-ink-3">kg</span>
                <span className="text-[10px] font-cond font-bold text-ink-4 ml-1 tabular-nums">
                  {Math.max(0, goalKg - latest.orm)}kg 남음
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 결론 한 줄 */}
      <p className="text-xs text-ink-1 leading-relaxed">
        <span className="text-ink-0 font-bold">{monthDay(latest.date)}</span>에{" "}
        <span style={{ color: VOLT }} className="font-bold">
          {latest.weight}kg
        </span>
        을 <span className="text-ink-0 font-bold">{latest.reps}회</span> 수행해 추정 1RM{" "}
        <span style={{ color: VOLT }} className="font-bold">
          {latest.orm}kg
        </span>
        를 기록했습니다.
      </p>

      {/* 시작/현재/목표 통합 마일스톤 바 — 관리자 전체 대시보드에서만 표시 */}
      {!bare && first && allPRs.length >= 2 && (
        goalKg && goalKg > first.orm ? (
          <div
            className="rounded-2xl p-3"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--pt-5)" }}
          >
            <div className="flex items-center justify-between text-[10px] font-cond font-bold text-ink-3 mb-2">
              <span>시작 {first.orm}kg</span>
              <span style={{ color: VOLT }}>현재 {latest.orm}kg</span>
              <span className="text-ink-4">목표 {goalKg}kg</span>
            </div>
            <div
              className="relative rounded-full overflow-hidden"
              style={{ height: 10, width: "100%", background: "var(--pt-4)" }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${Math.min(100, Math.round((latest.orm / goalKg) * 100))}%`,
                  background: `linear-gradient(90deg, ${VOLT}50 0%, ${VOLT} 100%)`,
                  boxShadow: `0 0 10px ${VOLT_GLOW}`,
                }}
              />
              <div
                className="absolute top-0 bottom-0"
                style={{
                  left: `${Math.min(98, Math.round((first.orm / goalKg) * 100))}%`,
                  width: 2,
                  background: "rgba(0,0,0,0.6)",
                }}
              />
              <div
                className="absolute top-0 bottom-0"
                style={{ right: 0, width: 2, background: "rgba(255,255,255,0.4)" }}
              />
            </div>
          </div>
        ) : (
          <div
            className="rounded-2xl p-3"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--pt-5)" }}
          >
            <div className="flex items-center justify-between text-[10px] font-cond font-bold text-ink-3 mb-2">
              <span>시작 {first.orm}kg</span>
              <span style={{ color: VOLT }}>현재 {latest.orm}kg</span>
            </div>
            <div
              className="relative rounded-full overflow-hidden"
              style={{ height: 10, width: "100%", background: "var(--pt-4)" }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: "100%",
                  background: `linear-gradient(90deg, ${VOLT}50 0%, ${VOLT} 100%)`,
                  boxShadow: `0 0 10px ${VOLT_GLOW}`,
                }}
              />
              <div
                className="absolute top-0 bottom-0"
                style={{
                  left: `${Math.min(96, Math.round((first.orm / latest.orm) * 100))}%`,
                  width: 2,
                  background: "rgba(0,0,0,0.6)",
                }}
              />
            </div>
          </div>
        )
      )}

      {/* PR 타임라인 — 접이식 아코디언 */}
      {allPRs.length >= 3 && (
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setPrOpen((v) => !v)}
            className="tap-haptic w-full flex items-center justify-between py-0.5"
          >
            <span className="text-xs font-cond font-bold text-ink-3">
              PR 기록 보기 ({allPRs.length}회)
            </span>
            {prOpen ? (
              <ChevronUp size={15} className="text-ink-3" />
            ) : (
              <ChevronDown size={15} className="text-ink-3" />
            )}
          </button>
          {prOpen && (
            <div className="flex gap-2 pt-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {allPRs.map((pr, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-1 items-center shrink-0"
                  style={{ minWidth: 44 }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: i === allPRs.length - 1 ? VOLT : "rgba(211,255,82,0.3)",
                      boxShadow:
                        i === allPRs.length - 1 ? `0 0 8px ${VOLT_GLOW}` : undefined,
                    }}
                  />
                  <span
                    className="text-[8px] font-cond tabular-nums leading-none"
                    style={{
                      color: i === allPRs.length - 1 ? VOLT : "var(--ink-4)",
                    }}
                  >
                    {pr.orm}
                  </span>
                  <span className="text-[7px] font-cond text-ink-4 leading-none">
                    {pr.date.slice(5, 7)}/{pr.date.slice(8, 10)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
