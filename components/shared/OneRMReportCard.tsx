"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Trophy, Calendar } from "lucide-react";
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
  startDate,
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
      className="pt-card flex flex-col gap-5 anim-fade-slide"
      style={{
        padding: 22,
        background: `linear-gradient(160deg, ${color}10 0%, rgba(20,20,20,0.88) 65%)`,
        borderColor: `${color}35`,
      }}
    >
      {/* 헤더 */}
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

      {/* 지용 PT 리포트 텍스트 */}
      <div
        className="rounded-2xl p-4 flex flex-col gap-2"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${color}25`,
        }}
      >
        <div className="flex items-center gap-2">
          <Calendar size={11} style={{ color }} />
          <p
            className="text-[9px] font-cond font-bold tracking-wider leading-none uppercase"
            style={{ color }}
          >
            지용 PT 리포트
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

          {/* 처음 vs 지금 바 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-cond text-ink-3 w-10 text-right leading-none shrink-0">
                시작
              </span>
              <div
                className="rounded-full"
                style={{
                  height: 10,
                  flex: `0 0 ${Math.round((first.orm / latest.orm) * 100)}%`,
                  background: `${color}40`,
                  border: `1px solid ${color}30`,
                }}
              />
              <span className="text-[10px] font-cond text-ink-2 tabular-nums leading-none">
                {first.orm}kg
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-cond leading-none w-10 text-right shrink-0" style={{ color }}>
                현재
              </span>
              <div
                className="rounded-full"
                style={{
                  height: 10,
                  flex: "0 0 100%",
                  background: `linear-gradient(90deg, ${color}80 0%, ${color} 100%)`,
                  boxShadow: `0 0 10px ${glow}`,
                }}
              />
              <span
                className="text-[10px] font-cond font-bold tabular-nums leading-none"
                style={{ color }}
              >
                {latest.orm}kg
              </span>
            </div>
          </div>

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
