"use client";

import { useMemo } from "react";
import { Flame, ChevronRight } from "lucide-react";
import {
  type Member,
  type Session,
  type ExerciseRecord,
  type BenchmarkData,
  calcOneRM,
} from "@/lib/types";

interface Props {
  member: Member;
  sessions: Session[];
  recordsBySession: Record<string, ExerciseRecord[]>;
  benchmarks: BenchmarkData[];
}

/* 5단계 등급 */
const TIERS = ["NOVICE", "BEGINNER", "INTERMEDIATE", "ADVANCED", "ELITE"] as const;
type Tier = (typeof TIERS)[number];

interface BigStat {
  exercise: string;
  color: string;
  my: number;
  tier: Tier;
  /** 0~100 percentile */
  percentile: number;
  nextTierName: Tier | null;
  needKg: number;
  /** 4주 성장률 % */
  growthPct: number;
}

const COLOR_BY_EX: Record<string, string> = {
  스쿼트: "#D3FF52",
  데드리프트: "#5BA8FF",
  벤치프레스: "#E8E8E8",
};

export function ComparisonGauge({
  member,
  sessions,
  recordsBySession,
  benchmarks,
}: Props) {
  const stats: BigStat[] = useMemo(() => {
    const completed = sessions
      .filter((s) => s.status === "completed")
      .sort((a, b) => a.date.localeCompare(b.date));

    // 종목별 1RM 추이
    const byExercise = new Map<string, { date: string; orm: number }[]>();
    completed.forEach((s) => {
      const recs = recordsBySession[s.id] ?? [];
      recs.forEach((r) => {
        const orm = calcOneRM(r.weight ?? 0, r.reps ?? 0);
        if (orm > 0) {
          if (!byExercise.has(r.exercise_name))
            byExercise.set(r.exercise_name, []);
          byExercise.get(r.exercise_name)!.push({ date: s.date, orm });
        }
      });
    });

    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const fourWeeksAgoStr = fourWeeksAgo.toISOString().slice(0, 10);

    return (["스쿼트", "데드리프트", "벤치프레스"] as const)
      .map((ex) => {
        const points = byExercise.get(ex) ?? [];
        if (points.length === 0) return null;

        const my = Math.max(...points.map((p) => p.orm));
        const bench = benchmarks.find((b) => b.exercise_name === ex);
        if (!bench) return null;

        const { beginner_kg, intermediate_kg, advanced_kg, elite_kg } = bench;

        // 등급 결정 + 백분위 계산
        let tier: Tier;
        let percentile: number;
        let nextTierName: Tier | null;
        let needKg: number;

        if (my >= elite_kg) {
          tier = "ELITE";
          percentile = 99;
          nextTierName = null;
          needKg = 0;
        } else if (my >= advanced_kg) {
          tier = "ADVANCED";
          percentile =
            75 + ((my - advanced_kg) / Math.max(1, elite_kg - advanced_kg)) * 24;
          nextTierName = "ELITE";
          needKg = elite_kg - my;
        } else if (my >= intermediate_kg) {
          tier = "INTERMEDIATE";
          percentile =
            50 +
            ((my - intermediate_kg) /
              Math.max(1, advanced_kg - intermediate_kg)) *
              25;
          nextTierName = "ADVANCED";
          needKg = advanced_kg - my;
        } else if (my >= beginner_kg) {
          tier = "BEGINNER";
          percentile =
            25 +
            ((my - beginner_kg) / Math.max(1, intermediate_kg - beginner_kg)) *
              25;
          nextTierName = "INTERMEDIATE";
          needKg = intermediate_kg - my;
        } else {
          tier = "NOVICE";
          percentile = (my / Math.max(1, beginner_kg)) * 25;
          nextTierName = "BEGINNER";
          needKg = beginner_kg - my;
        }

        // 4주 성장률
        const past =
          points.find((p) => p.date >= fourWeeksAgoStr)?.orm ?? points[0].orm;
        const growthPct =
          past > 0 ? Math.round(((my - past) / past) * 100 * 10) / 10 : 0;

        return {
          exercise: ex,
          color: COLOR_BY_EX[ex] ?? "var(--volt)",
          my: Math.round(my),
          tier,
          percentile: Math.max(0, Math.min(100, percentile)),
          nextTierName,
          needKg: Math.round(Math.max(0, needKg)),
          growthPct,
        } as BigStat;
      })
      .filter((s): s is BigStat => s !== null);
  }, [sessions, recordsBySession, benchmarks]);

  if (stats.length === 0) return null;

  return (
    <section className="px-5 flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-2xl text-ink-0 tracking-wider leading-none uppercase">
            COMPARISON BENCHMARK
          </h2>
          <p className="text-xs font-cond text-ink-3 leading-none">
            나의 위치 · Novice → Elite
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {stats.map((s) => (
          <GaugeRow key={s.exercise} stat={s} />
        ))}
      </div>
    </section>
  );
}

/* ─── 단일 종목 게이지 ──────────────── */
function GaugeRow({ stat }: { stat: BigStat }) {
  return (
    <div
      className="pt-card flex flex-col gap-5 anim-fade-slide"
      style={{ padding: 22 }}
    >
      {/* 헤더 */}
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{
              background: stat.color,
              boxShadow: `0 0 8px ${stat.color}80`,
            }}
          />
          <p
            className="font-cond font-bold uppercase tracking-wider leading-none"
            style={{ fontSize: 13, color: stat.color }}
          >
            {stat.exercise}
          </p>
        </div>
        <p
          className="font-display tabular-nums leading-none"
          style={{ fontSize: 22, color: "var(--ink-0)" }}
        >
          {stat.my}
          <span className="text-ink-3 text-xs ml-1">kg</span>
        </p>
      </div>

      {/* 게이지 바 */}
      <div className="relative">
        <div
          className="w-full rounded-full overflow-visible relative"
          style={{
            height: 12,
            background: "linear-gradient(180deg, var(--pt-1) 0%, var(--pt-2) 100%)",
            border: "1px solid var(--pt-5)",
          }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${stat.percentile}%`,
              background: `linear-gradient(90deg, ${stat.color}80 0%, ${stat.color} 100%)`,
              boxShadow: `0 0 12px ${stat.color}60`,
              transition: "width 0.7s cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          />

          {/* 마커 */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
            style={{ left: `${stat.percentile}%` }}
          >
            <div
              className="rounded-full anim-pulse"
              style={{
                width: 16,
                height: 16,
                background: stat.color,
                border: "2px solid #000",
                boxShadow: `0 0 10px ${stat.color}, 0 0 20px ${stat.color}80`,
              }}
            />
          </div>
        </div>

        {/* 등급 라벨 */}
        <div className="flex justify-between mt-2.5 px-1">
          {TIERS.map((t) => (
            <span
              key={t}
              className="font-cond text-[8px] leading-none tracking-wider"
              style={{
                color: t === stat.tier ? stat.color : "var(--ink-4)",
                fontWeight: t === stat.tier ? 700 : 500,
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* 메트릭 + 다음 등급 */}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
        {/* 4주 성장률 */}
        {stat.growthPct !== 0 && (
          <div className="flex items-center gap-2">
            <Flame
              size={12}
              style={{
                color: stat.growthPct > 0 ? stat.color : "var(--ink-3)",
              }}
            />
            <p className="font-cond text-[11px] leading-none">
              <span className="text-ink-3">최근 4주</span>{" "}
              <span
                className="font-bold tabular-nums"
                style={{
                  color: stat.growthPct > 0 ? stat.color : "#ff8080",
                }}
              >
                {stat.growthPct > 0 ? "+" : ""}
                {stat.growthPct}%
              </span>
            </p>
          </div>
        )}

        {/* 다음 등급 */}
        {stat.nextTierName && stat.needKg > 0 && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{
              background: `${stat.color}1A`,
              border: `1px solid ${stat.color}40`,
            }}
          >
            <span className="text-[10px] font-cond text-ink-2 leading-none">
              {stat.nextTierName}까지 단
            </span>
            <span
              className="font-display tabular-nums leading-none"
              style={{ color: stat.color, fontSize: 14 }}
            >
              {stat.needKg}kg
            </span>
            <ChevronRight size={11} style={{ color: stat.color }} />
          </div>
        )}
      </div>
    </div>
  );
}
