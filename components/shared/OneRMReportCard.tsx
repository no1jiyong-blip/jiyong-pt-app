"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Trophy, ShieldCheck } from "lucide-react";
import type { Session, ExerciseRecord } from "@/lib/types";
import { calcOneRM } from "@/lib/types";

interface Props {
  exerciseName: string;
  color: string;
  glow: string;
  sessions: Session[];
  recordsBySession: Record<string, ExerciseRecord[]>;
  /** 등록 첫 세션 기준으로 총 성장 계산 */
  startDate?: string | null;
  /** true면 바깥 pt-card 래퍼 없이 내용만 렌더링 (다른 카드 안에 중첩할 때) */
  bare?: boolean;
  /** ACSM 벤치마크 기준 다음 등급 목표 중량 — 있으면 시작/현재/목표 통합 바로 표시 */
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
  color,
  glow,
  sessions,
  recordsBySession,
  bare = false,
  goalKg,
}: Props) {
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
              background: `linear-gradient(160deg, ${color}10 0%, rgba(20,20,20,0.88) 65%)`,
              borderColor: `${color}35`,
            }
      }
    >
      {/* 헤더 (bare일 때는 상위 카드가 이미 종목명/색상을 표시하므로 생략) */}
      {!bare && (
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{
                background: color,
                boxShadow: `0 0 10px ${glow}`,
              }}
            />
            <p
              className="font-cond font-bold uppercase tracking-wider leading-none"
              style={{ color, fontSize: 13 }}
            >
              {exerciseName}
            </p>
          </div>
          <div className="flex items-baseline gap-1.5">
            {prevChangePct !== null && (
              <span
                className="flex items-center gap-1 text-[11px] font-cond font-bold leading-none"
                style={{ color: isUp ? color : "var(--danger)" }}
              >
                {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {isUp ? "+" : ""}
                {prevChangePct}%
              </span>
            )}
          </div>
        </div>
      )}

      {/* 현재 1RM 대형 표시 */}
      <div className="flex flex-col gap-2">
        <p
          className="font-display tabular-nums leading-none"
          style={{
            fontSize: 54,
            color,
            textShadow: `0 0 20px ${glow}`,
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

      {/* 트레이너 코칭 리포트 (자동 생성 요약) */}
      <div
        className="rounded-2xl p-4 flex flex-col gap-2"
        style={{
          background: "rgba(0,0,0,0.35)",
          border: `1px solid ${color}25`,
        }}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={13} style={{ color }} />
          <p
            className="text-[10px] font-cond font-bold tracking-wider leading-none uppercase"
            style={{ color }}
          >
            TRAINER COACHING REPORT
          </p>
        </div>
        <p className="text-xs text-ink-1 leading-relaxed">
          <span className="text-ink-0 font-bold">
            {monthDay(latest.date)}
          </span>
          에{" "}
          <span style={{ color }} className="font-bold">
            {latest.weight}kg
          </span>
          을{" "}
          <span className="text-ink-0 font-bold">{latest.reps}회</span> 수행하여
          추정 1RM이{" "}
          <span style={{ color }} className="font-bold">
            {latest.orm}kg
          </span>
          으로 측정됐습니다.
          {prevChangePct !== null && (
            <>
              {" "}
              이전 기록 대비{" "}
              <span
                className="font-bold"
                style={{ color: isUp ? color : "var(--danger)" }}
              >
                {isUp ? "+" : ""}
                {prevChangePct}% {isUp ? "상승" : "하락"}
              </span>
              했습니다.
            </>
          )}
        </p>
      </div>

      {/* 총 성장 시각화 */}
      {first && allPRs.length >= 2 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-cond text-ink-3 uppercase tracking-wider leading-none">
              등록 시점 대비 총 성장
            </p>
            <div className="flex items-center gap-2">
              <Trophy size={11} style={{ color }} />
              <span
                className="font-display tabular-nums leading-none"
                style={{ color, fontSize: 16 }}
              >
                +{totalGrowthKg}kg
              </span>
              <span
                className="text-[11px] font-cond font-bold leading-none"
                style={{ color }}
              >
                (+{totalGrowthPct}%)
              </span>
            </div>
          </div>

          {/* 시작/현재/목표 통합 마일스톤 바 — 트랙 하나 안에 안전하게 (% 기반, 화면 밖으로 안 나감) */}
          {goalKg && goalKg > first.orm ? (
            <div
              className="rounded-2xl p-3"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--pt-5)" }}
            >
              <div className="flex items-center justify-between text-[10px] font-cond font-bold text-ink-3 mb-2">
                <span>시작 {first.orm}kg</span>
                <span style={{ color }}>현재 {latest.orm}kg</span>
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
                    background: `linear-gradient(90deg, ${color}50 0%, ${color} 100%)`,
                    boxShadow: `0 0 10px ${glow}`,
                  }}
                />
                {/* 시작 지점 마커 */}
                <div
                  className="absolute top-0 bottom-0"
                  style={{
                    left: `${Math.min(98, Math.round((first.orm / goalKg) * 100))}%`,
                    width: 2,
                    background: "rgba(0,0,0,0.6)",
                  }}
                />
                {/* 목표 지점 마커 */}
                <div
                  className="absolute top-0 bottom-0"
                  style={{ right: 0, width: 2, background: "rgba(255,255,255,0.4)" }}
                />
              </div>
              <div className="flex justify-end mt-1.5">
                <span className="text-[9px] font-mono-num font-bold" style={{ color }}>
                  목표 달성도 {Math.max(0, Math.min(100, Math.round(((latest.orm - first.orm) / (goalKg - first.orm)) * 100)))}%
                </span>
              </div>
            </div>
          ) : (
            <div
              className="rounded-2xl p-3"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--pt-5)" }}
            >
              <div className="flex items-center justify-between text-[10px] font-cond font-bold text-ink-3 mb-2">
                <span>시작 {first.orm}kg</span>
                <span style={{ color }}>현재 {latest.orm}kg</span>
              </div>
              <div
                className="relative rounded-full overflow-hidden"
                style={{ height: 10, width: "100%", background: "var(--pt-4)" }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: "100%",
                    background: `linear-gradient(90deg, ${color}50 0%, ${color} 100%)`,
                    boxShadow: `0 0 10px ${glow}`,
                  }}
                />
                {/* 시작 지점 마커 */}
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
          )}

          {/* PR 타임라인 */}
          {allPRs.length >= 3 && (
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
                      background: i === allPRs.length - 1 ? color : `${color}50`,
                      boxShadow:
                        i === allPRs.length - 1 ? `0 0 8px ${glow}` : undefined,
                    }}
                  />
                  <span
                    className="text-[8px] font-cond tabular-nums leading-none"
                    style={{
                      color: i === allPRs.length - 1 ? color : "var(--ink-4)",
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
