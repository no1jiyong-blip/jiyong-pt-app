"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Target, Activity } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  type BenchmarkData,
  type Member,
  type Session,
  type ExerciseRecord,
  calcOneRM,
  getAgeGroup,
  getAge,
} from "@/lib/types";

interface Props {
  member: Member;
  sessions: Session[];
  recordsBySession: Record<string, ExerciseRecord[]>;
  /** "운동 일지로 가기" 버튼 클릭 콜백 */
  onCtaClick?: () => void;
}

/** 3대 운동 정의 + 색상 (벤치마크 강조용) */
const BIG3 = [
  { name: "스쿼트", color: "#D3FF52", glow: "rgba(211,255,82,0.4)" }, // Volt
  { name: "데드리프트", color: "#5BA8FF", glow: "rgba(91,168,255,0.4)" }, // Blue
  { name: "벤치프레스", color: "#E8E8E8", glow: "rgba(232,232,232,0.4)" }, // White
] as const;

export function GlobalBenchmarkPanel({
  member,
  sessions,
  recordsBySession,
  onCtaClick,
}: Props) {
  const [benchmarks, setBenchmarks] = useState<BenchmarkData[]>([]);
  const [loading, setLoading] = useState(true);

  const ageGroup = getAgeGroup(member.birth_date);
  const age = getAge(member.birth_date);
  const genderLabel =
    member.gender === "male"
      ? "Males"
      : member.gender === "female"
      ? "Females"
      : null;
  const ageLabel = ageGroup
    ? ageGroup === "20s"
      ? "20s"
      : ageGroup === "30s"
      ? "30s"
      : ageGroup === "40s"
      ? "40s"
      : ageGroup === "50s"
      ? "50s"
      : "60+"
    : null;

  /* 벤치마크 데이터 로드 */
  useEffect(() => {
    if (!member.gender || !ageGroup) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("benchmark_data")
        .select("*")
        .eq("gender", member.gender!)
        .eq("age_group", ageGroup);
      setBenchmarks((data ?? []) as BenchmarkData[]);
      setLoading(false);
    })();
  }, [member.gender, ageGroup]);

  /* 회원 본인의 종목별 최대 1RM */
  const myMaxByExercise = useMemo(() => {
    const map = new Map<string, number>();
    sessions
      .filter((s) => s.status === "completed")
      .forEach((s) => {
        const recs = recordsBySession[s.id] ?? [];
        recs.forEach((r) => {
          const orm = calcOneRM(r.weight ?? 0, r.reps ?? 0);
          if (orm > 0) {
            const cur = map.get(r.exercise_name) ?? 0;
            if (orm > cur) map.set(r.exercise_name, orm);
          }
        });
      });
    return map;
  }, [sessions, recordsBySession]);

  /* 종목별 sparkline 시리즈 (날짜순 1RM 변화) */
  const sparklinesByExercise = useMemo(() => {
    const map = new Map<string, number[]>();
    const sorted = [...sessions]
      .filter((s) => s.status === "completed")
      .sort((a, b) => a.date.localeCompare(b.date));
    sorted.forEach((s) => {
      const recs = recordsBySession[s.id] ?? [];
      const seen = new Set<string>();
      recs.forEach((r) => {
        const orm = calcOneRM(r.weight ?? 0, r.reps ?? 0);
        if (orm <= 0) return;
        if (seen.has(r.exercise_name)) return;
        seen.add(r.exercise_name);
        if (!map.has(r.exercise_name)) map.set(r.exercise_name, []);
        const arr = map.get(r.exercise_name)!;
        // 같은 날 최대만 유지
        const last = arr[arr.length - 1];
        if (last !== undefined && orm <= last) return;
        arr.push(orm);
      });
    });
    return map;
  }, [sessions, recordsBySession]);

  /* 3대 운동 평균 백분위 계산 (전체 등급 기준) */
  const big3Stats = useMemo(() => {
    return BIG3.map((ex) => {
      const my = myMaxByExercise.get(ex.name) ?? 0;
      const bench = benchmarks.find((b) => b.exercise_name === ex.name);
      // 평균 = intermediate (중급)
      const avg = bench?.intermediate_kg ?? 0;
      const elite = bench?.elite_kg ?? 0;
      const beginner = bench?.beginner_kg ?? 0;
      const intermediate = bench?.intermediate_kg ?? 0;
      const advanced = bench?.advanced_kg ?? 0;

      // 5단계 위치 계산 → 0~100 백분위
      let percentile = 0;
      if (my <= 0) percentile = 0;
      else if (my >= elite) percentile = 99;
      else if (my >= advanced)
        percentile =
          75 + ((my - advanced) / Math.max(1, elite - advanced)) * 24;
      else if (my >= intermediate)
        percentile =
          50 + ((my - intermediate) / Math.max(1, advanced - intermediate)) * 25;
      else if (my >= beginner)
        percentile =
          25 + ((my - beginner) / Math.max(1, intermediate - beginner)) * 25;
      else percentile = (my / Math.max(1, beginner)) * 25;

      const diff = my - avg;
      return {
        ...ex,
        my: Math.round(my),
        avg: Math.round(avg),
        diff: Math.round(diff),
        percentile: Math.max(0, Math.min(100, percentile)),
        sparkline: sparklinesByExercise.get(ex.name) ?? [],
      };
    });
  }, [benchmarks, myMaxByExercise, sparklinesByExercise]);

  /* 전체 평균 백분위 (3대 운동 평균) */
  const overallPercentile = useMemo(() => {
    const valid = big3Stats.filter((s) => s.my > 0);
    if (valid.length === 0) return 0;
    return Math.round(
      valid.reduce((sum, s) => sum + s.percentile, 0) / valid.length
    );
  }, [big3Stats]);

  const topPct = Math.max(1, Math.round(100 - overallPercentile));

  /* NEXT MILESTONE — 가장 가까운 다음 등급으로 가는 데 필요한 증가량 */
  const milestone = useMemo(() => {
    // TOP 10% 진입 = percentile 90+
    const targetPercentile = overallPercentile >= 90 ? 99 : 90;
    const targetTopPct =
      overallPercentile >= 90 ? "TOP 1%" : "TOP 10%";

    // 각 종목별 목표 무게 산출 (advanced ↔ elite 사이 보간)
    const goals = big3Stats
      .filter((s) => s.my > 0)
      .map((s) => {
        const bench = benchmarks.find((b) => b.exercise_name === s.name);
        if (!bench) return null;
        // TOP 10% 기준 = advanced + 60% (advanced와 elite 사이)
        const target =
          targetPercentile >= 99
            ? bench.elite_kg
            : Math.round(bench.advanced_kg + (bench.elite_kg - bench.advanced_kg) * 0.6);
        const need = Math.max(0, target - s.my);
        return need > 0 ? { name: s.name, need, target, color: s.color } : null;
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);

    return { targetTopPct, goals };
  }, [big3Stats, benchmarks, overallPercentile]);

  /* 데이터 없을 때 */
  if (!member.gender || !ageGroup) {
    return (
      <section className="px-6 flex flex-col gap-5">
        <h2 className="section-title">
          <span className="section-bar-blue"></span>
          GLOBAL BENCHMARK
        </h2>
        <div className="pt-card-xl text-center">
          <p className="text-ink-3 font-cond text-sm leading-relaxed">
            성별 / 생년월일이 등록되어야
            <br />벤치마크 분석을 볼 수 있습니다
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 flex flex-col gap-6">
      {/* 1. DOMINANT PERCENTAGE */}
      <div
        className="pt-card-xl flex flex-col gap-6 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, rgba(211,255,82,0.10) 0%, var(--pt-3) 60%)",
          border: "1px solid var(--volt-glow-2)",
          boxShadow: "0 0 40px var(--volt-glow)",
        }}
      >
        {/* 배경 그리드 패턴 */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(211,255,82,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(211,255,82,0.05) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* 브랜딩 + 인구 컨텍스트 */}
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-volt" />
              <p className="text-[10px] font-cond font-bold text-volt tracking-wide-3 leading-none uppercase">
                JIYONG PT PRO
              </p>
            </div>
            <p className="text-xs font-cond text-ink-2 tracking-wider leading-none uppercase">
              Global Benchmark
            </p>
          </div>

          <div
            className="px-3 py-1.5 rounded-full text-[10px] font-cond font-bold tracking-wider leading-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--pt-6)",
              color: "var(--ink-2)",
            }}
          >
            {genderLabel && ageLabel
              ? `South Korea · ${genderLabel} · ${ageLabel}`
              : "—"}
          </div>
        </div>

        {/* 거대 TOP X% 텍스트 */}
        {loading ? (
          <p className="font-display text-volt text-2xl tracking-wider leading-none anim-pulse">
            ANALYZING...
          </p>
        ) : overallPercentile === 0 ? (
          <div className="flex flex-col gap-3 relative z-10">
            <p className="font-display text-3xl text-ink-2 tracking-wider leading-none">
              데이터 부족
            </p>
            <p className="text-xs font-cond text-ink-3 leading-relaxed">
              완료된 PT 세션과 운동 기록이 쌓이면 분석이 시작됩니다
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 relative z-10">
            <p className="text-xs font-cond text-ink-2 tracking-wider leading-none uppercase">
              YOU ARE
            </p>
            <p
              className="font-display leading-none tabular-nums"
              style={{
                fontSize: "clamp(72px, 18vw, 120px)",
                color: "var(--volt)",
                textShadow:
                  "0 0 40px rgba(211,255,82,0.6), 0 0 16px rgba(211,255,82,0.5)",
                letterSpacing: "-0.02em",
              }}
            >
              TOP {topPct}%
            </p>
            <p className="text-xs font-cond text-ink-3 leading-relaxed">
              of all lifters in your demographic
            </p>
          </div>
        )}

        {/* 가로 게이지 바 + Pulsing Marker */}
        {overallPercentile > 0 && (
          <div className="flex flex-col gap-3 relative z-10">
            <div
              className="relative w-full rounded-full overflow-visible"
              style={{
                height: 14,
                background: "linear-gradient(180deg, var(--pt-1) 0%, var(--pt-2) 100%)",
                border: "1px solid var(--pt-5)",
              }}
            >
              {/* Filled track */}
              <div
                className="h-full rounded-full"
                style={{
                  width: `${overallPercentile}%`,
                  background: "var(--grad-volt-bar)",
                  boxShadow: "0 0 16px var(--volt-glow-2)",
                }}
              />

              {/* Pulsing marker */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 anim-pulse"
                style={{ left: `${overallPercentile}%` }}
              >
                <div
                  className="w-5 h-5 rounded-full"
                  style={{
                    background: "var(--volt)",
                    border: "2px solid #000",
                    boxShadow:
                      "0 0 12px rgba(211,255,82,0.8), 0 0 24px rgba(211,255,82,0.5)",
                  }}
                />
              </div>
            </div>

            <div className="flex justify-between text-[10px] font-cond text-ink-3 leading-none tracking-wider">
              <span>NOVICE</span>
              <span>BEGINNER</span>
              <span>INTERMEDIATE</span>
              <span>ADVANCED</span>
              <span className="text-volt font-bold">ELITE</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. LIFT COMPARISONS — 3대 운동 카드 */}
      {big3Stats.some((s) => s.my > 0) && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-cond font-bold text-ink-2 tracking-wide-2 uppercase leading-none px-1">
            LIFT COMPARISONS
          </p>

          {big3Stats.map((stat) => (
            <LiftComparisonCard key={stat.name} stat={stat} />
          ))}
        </div>
      )}

      {/* 3. NEXT MILESTONE */}
      {milestone.goals.length > 0 && (
        <div
          className="pt-card-xl flex flex-col gap-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(91,168,255,0.10) 0%, var(--pt-3) 70%)",
            border: "1px solid rgba(91,168,255,0.3)",
          }}
        >
          <div className="flex items-center gap-2">
            <Target size={14} style={{ color: "#5BA8FF" }} />
            <p
              className="text-xs font-cond font-bold tracking-wide-2 uppercase leading-none"
              style={{ color: "#5BA8FF" }}
            >
              NEXT MILESTONE
            </p>
          </div>

          <p
            className="font-display tracking-wider leading-none"
            style={{
              fontSize: 40,
              color: "var(--ink-0)",
              textShadow: "0 0 16px rgba(91,168,255,0.4)",
            }}
          >
            BREAK INTO {milestone.targetTopPct}
          </p>

          <div className="flex flex-col gap-2 pt-1">
            {milestone.goals.map((g) => (
              <div
                key={g.name}
                className="flex items-center gap-3 p-4 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--pt-5)",
                }}
              >
                <div
                  className="w-2 h-8 rounded-full shrink-0"
                  style={{
                    background: g.color,
                    boxShadow: `0 0 8px ${g.color}80`,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-cond font-bold text-ink-0 text-sm leading-none">
                    {g.name}
                  </p>
                  <p className="text-[11px] text-ink-3 font-cond mt-1 leading-none">
                    목표 {g.target}kg
                  </p>
                </div>
                <p
                  className="font-display leading-none tabular-nums"
                  style={{
                    color: g.color,
                    fontSize: 22,
                  }}
                >
                  +{g.need}KG
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. CTA */}
      {onCtaClick && (
        <button
          onClick={onCtaClick}
          className="tap-haptic w-full rounded-2xl flex items-center justify-center gap-3 font-display tracking-wider"
          style={{
            background: "var(--grad-volt)",
            color: "#000",
            height: 64,
            fontSize: 18,
            boxShadow:
              "0 8px 32px var(--volt-glow-2), inset 0 1px 0 rgba(255,255,255,0.3)",
          }}
        >
          GO TO WORKOUT PLAN
          <ArrowRight size={20} strokeWidth={2.5} />
        </button>
      )}
    </section>
  );
}

/* ─── 종목별 비교 카드 ──────────────────────────── */
function LiftComparisonCard({
  stat,
}: {
  stat: {
    name: string;
    color: string;
    glow: string;
    my: number;
    avg: number;
    diff: number;
    percentile: number;
    sparkline: number[];
  };
}) {
  const isAbove = stat.diff >= 0;

  return (
    <div
      className="pt-card-xl flex flex-col gap-5 overflow-hidden relative"
      style={{
        background: "linear-gradient(135deg, var(--pt-3) 0%, var(--pt-2) 100%)",
        border: `1px solid ${stat.color}30`,
      }}
    >
      {/* 좌측 컬러 바 */}
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{
          width: 4,
          background: stat.color,
          boxShadow: `0 0 12px ${stat.glow}`,
        }}
      />

      <div className="flex items-start justify-between gap-3 ml-2">
        <div className="flex flex-col gap-2 min-w-0">
          <p
            className="font-cond font-bold tracking-wider leading-none uppercase"
            style={{ color: stat.color, fontSize: 13 }}
          >
            {stat.name}
          </p>
          {stat.my > 0 ? (
            <p
              className="font-display leading-none tabular-nums"
              style={{
                fontSize: 48,
                color: "var(--ink-0)",
                textShadow: `0 0 16px ${stat.glow}`,
              }}
            >
              {stat.my}
              <span className="text-ink-3 text-base ml-1.5">kg</span>
            </p>
          ) : (
            <p className="font-display text-3xl text-ink-3 leading-none">—</p>
          )}
        </div>

        {/* Sparkline */}
        {stat.sparkline.length >= 2 && (
          <Sparkline data={stat.sparkline} color={stat.color} />
        )}
      </div>

      {/* VS AVERAGE */}
      {stat.my > 0 && stat.avg > 0 && (
        <div className="flex items-center justify-between gap-3 ml-2">
          <p className="text-[10px] font-cond text-ink-3 tracking-wider leading-none uppercase">
            VS. AVERAGE
          </p>
          <p
            className="font-display tabular-nums leading-none"
            style={{
              fontSize: 22,
              color: isAbove ? stat.color : "var(--danger)",
            }}
          >
            {isAbove ? "+" : ""}
            {stat.diff}
            <span className="text-ink-3 text-xs ml-1">kg</span>
          </p>
        </div>
      )}

      {/* 미니 위치 게이지 */}
      {stat.my > 0 && (
        <div className="flex flex-col gap-2 ml-2">
          <div
            className="w-full rounded-full overflow-hidden"
            style={{
              height: 6,
              background: "var(--pt-1)",
              border: "1px solid var(--pt-5)",
            }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${stat.percentile}%`,
                background: stat.color,
                boxShadow: `0 0 8px ${stat.glow}`,
              }}
            />
          </div>
          <p
            className="text-[10px] font-cond font-bold tracking-wider leading-none text-right"
            style={{ color: stat.color }}
          >
            TOP {Math.max(1, Math.round(100 - stat.percentile))}%
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Sparkline (mini line chart) ──────────────── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 80;
  const h = 36;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  const lastX = w;
  const lastY = h - ((data[data.length - 1] - min) / range) * h;

  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        style={{ filter: `drop-shadow(0 0 4px ${color}80)` }}
      />
      <circle
        cx={lastX}
        cy={lastY}
        r={2.5}
        fill={color}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
    </svg>
  );
}
