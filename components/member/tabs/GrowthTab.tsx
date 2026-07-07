"use client";

import { useEffect, useMemo, useState } from "react";
import { Dumbbell, Activity, BarChart3 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  type Member,
  type Session,
  type ExerciseRecord,
  type BenchmarkData,
  type SessionQuality,
  type PersonalLog,
  calcOneRM,
  getAgeGroup,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { TabHeader } from "@/components/member/TabHeader";
import { Confetti } from "@/components/shared/Confetti";
import { MuscleBalanceRadar } from "@/components/shared/MuscleBalanceRadar";
import { HeroSBDChart } from "@/components/shared/HeroSBDChart";
import { SupportCarousel } from "@/components/shared/SupportCarousel";
import { OneRMReportCard } from "@/components/shared/OneRMReportCard";
import { BodyMetrics } from "@/components/shared/BodyMetrics";
import { AnalysisInsights } from "@/components/shared/AnalysisInsights";
import { TrainerAssessmentCard } from "@/components/shared/TrainerAssessmentCard";

interface Props {
  member: Member;
  sessions: Session[];
  recordsBySession: Record<string, ExerciseRecord[]>;
  personalLogs: PersonalLog[];
}

type SubTab = "strength" | "body" | "analysis";

/* ─── 성별별 3대 운동 설정 ─── */
const MALE_SBD = [
  { name: "스쿼트", color: "#D3FF52", glow: "rgba(211,255,82,0.5)" },
  { name: "데드리프트", color: "#5BA8FF", glow: "rgba(91,168,255,0.5)" },
  { name: "벤치프레스", color: "#E8E8E8", glow: "rgba(232,232,232,0.4)" },
];
const FEMALE_SBD = [
  { name: "스쿼트", color: "#D3FF52", glow: "rgba(211,255,82,0.5)" },
  { name: "데드리프트", color: "#5BA8FF", glow: "rgba(91,168,255,0.5)" },
  { name: "숄더프레스", color: "#ff8c00", glow: "rgba(255,140,0,0.5)" },
];

export function GrowthTab({
  member,
  sessions,
  recordsBySession,
  personalLogs,
}: Props) {
  const [subTab, setSubTab] = useState<SubTab>("strength");
  const [benchmarks, setBenchmarks] = useState<BenchmarkData[]>([]);
  const [qualities, setQualities] = useState<SessionQuality[]>([]);
  const [confettiKey, setConfettiKey] = useState(0);

  const ageGroup = getAgeGroup(member.birth_date);
  const sbdConfig = member.gender === "female" ? FEMALE_SBD : MALE_SBD;

  /* 데이터 로드 */
  useEffect(() => {
    (async () => {
      if (member.gender && ageGroup) {
        const { data } = await supabase
          .from("benchmark_data")
          .select("*")
          .eq("gender", member.gender)
          .eq("age_group", ageGroup);
        setBenchmarks((data ?? []) as BenchmarkData[]);
      }

      const completedIds = sessions
        .filter((s) => s.status === "completed")
        .map((s) => s.id);
      if (completedIds.length > 0) {
        const { data } = await supabase
          .from("session_quality")
          .select("*")
          .in("session_id", completedIds);
        setQualities((data ?? []) as SessionQuality[]);
      }
    })();
  }, [member.gender, ageGroup, sessions]);

  /* 진입 시 컨페티 1회 */
  useEffect(() => {
    const t = setTimeout(() => setConfettiKey(1), 300);
    return () => clearTimeout(t);
  }, []);

  /* 종합 등급 계산 */
  const overall = useMemo(() => {
    const myMax = new Map<string, number>();
    sessions
      .filter((s) => s.status === "completed")
      .forEach((s) => {
        (recordsBySession[s.id] ?? []).forEach((r) => {
          const orm = calcOneRM(r.weight ?? 0, r.reps ?? 0);
          if (orm > 0) {
            const cur = myMax.get(r.exercise_name) ?? 0;
            if (orm > cur) myMax.set(r.exercise_name, orm);
          }
        });
      });

    const percentiles: number[] = [];
    sbdConfig.forEach(({ name }) => {
      const my = myMax.get(name) ?? 0;
      if (my <= 0) return;
      const bench = benchmarks.find((b) => b.exercise_name === name);
      if (!bench) return;
      const { beginner_kg, intermediate_kg, advanced_kg, elite_kg } = bench;
      let pct =
        my >= elite_kg
          ? 99
          : my >= advanced_kg
          ? 75 + ((my - advanced_kg) / Math.max(1, elite_kg - advanced_kg)) * 24
          : my >= intermediate_kg
          ? 50 +
            ((my - intermediate_kg) /
              Math.max(1, advanced_kg - intermediate_kg)) *
              25
          : my >= beginner_kg
          ? 25 +
            ((my - beginner_kg) /
              Math.max(1, intermediate_kg - beginner_kg)) *
              25
          : (my / Math.max(1, beginner_kg)) * 25;
      percentiles.push(Math.max(0, Math.min(100, pct)));
    });

    const avg =
      percentiles.length > 0
        ? Math.round(percentiles.reduce((a, b) => a + b, 0) / percentiles.length)
        : 0;
    return { avg, topPct: Math.max(1, 100 - avg), valid: percentiles.length > 0 };
  }, [sessions, recordsBySession, benchmarks, sbdConfig]);

  return (
    <div className="anim-tab-slide flex flex-col gap-7 pt-2">
      <Confetti trigger={confettiKey} count={32} />

      {/* 헤더 */}
      <div className="px-5">
        <TabHeader title="GROWTH REPORT" subtitle="데이터로 증명되는 당신의 발전" />
      </div>

      {/* TOTAL STRENGTH RANK */}
      {overall.valid && (
        <div className="px-5">
          <TotalStrengthRank
            topPct={overall.topPct}
            percentile={overall.avg}
            gender={member.gender}
            ageGroup={ageGroup}
          />
        </div>
      )}

      {/* 서브탭 세그먼트 컨트롤 */}
      <div className="px-5">
        <SegmentControl value={subTab} onChange={setSubTab} />
      </div>

      {/* ─── STRENGTH 탭 ─── */}
      {subTab === "strength" && (
        <div className="flex flex-col gap-8">
          {/* ① Muscle Balance 레이더 (STRENGTH 탭으로 통합) */}
          <div className="px-5">
            <MuscleBalanceRadar
              sessions={sessions}
              recordsBySession={recordsBySession}
              qualities={qualities}
            />
          </div>

          {/* ② 성별 맞춤 1RM 리포트 카드 */}
          <section className="px-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <h3
                className="font-display text-ink-0 leading-none tracking-wide uppercase"
                style={{ fontSize: 20 }}
              >
                1RM REPORT
              </h3>
              <p className="text-[11px] font-cond text-ink-3 leading-none">
                {member.gender === "female"
                  ? "스쿼트 · 데드리프트 · 숄더프레스"
                  : "스쿼트 · 데드리프트 · 벤치프레스"}
              </p>
            </div>

            {sbdConfig.map((ex) => (
              <OneRMReportCard
                key={ex.name}
                exerciseName={ex.name}
                color={ex.color}
                glow={ex.glow}
                sessions={sessions}
                recordsBySession={recordsBySession}
                startDate={member.session_start_date}
              />
            ))}
          </section>

          {/* ③ Hero SBD 차트 (그래프) */}
          <div className="px-5">
            <HeroSBDChart
              sessions={sessions}
              recordsBySession={recordsBySession}
              benchmarks={benchmarks}
              gender={member.gender}
            />
          </div>

          {/* ④ 보조 종목 캐러셀 */}
          <div className="px-5">
            <SupportCarousel
              sessions={sessions}
              recordsBySession={recordsBySession}
            />
          </div>
        </div>
      )}

      {/* ─── BODY 탭 ─── */}
      {subTab === "body" && (
        <div className="px-5">
          <BodyMetrics memberId={member.id} gender={member.gender} age={member.birth_date} />
        </div>
      )}

      {/* ─── ANALYSIS 탭 ─── */}
      {subTab === "analysis" && (
        <div className="px-5">
          <AnalysisInsights
            member={member}
            sessions={sessions}
            recordsBySession={recordsBySession}
            personalLogs={personalLogs}
          />
        </div>
      )}

      {/* ─── 트레이너 소견 + 핵심 미션 (하단 고정) ─── */}
      <div className="px-5">
        <TrainerAssessmentCard
          trainerAssessment={member.trainer_assessment}
          weeklyMission={member.weekly_mission}
        />
      </div>

      <div style={{ height: 12 }} />
    </div>
  );
}

/* ── Total Strength Rank ── */
function TotalStrengthRank({
  topPct,
  percentile,
  gender,
  ageGroup,
}: {
  topPct: number;
  percentile: number;
  gender: "male" | "female" | null;
  ageGroup: ReturnType<typeof getAgeGroup>;
}) {
  const demoLabel =
    gender && ageGroup
      ? `South Korea · ${gender === "male" ? "Males" : "Females"} · ${ageGroup}`
      : "";
  const glowDensity = topPct <= 5 ? 1 : topPct <= 25 ? 0.7 : 0.4;

  return (
    <div
      className="pt-card flex flex-col gap-5 relative overflow-hidden"
      style={{
        padding: 22,
        background: `linear-gradient(160deg, rgba(211,255,82,${0.07 + glowDensity * 0.05}) 0%, rgba(20,20,20,0.88) 60%)`,
        borderColor: "var(--volt-glow-2)",
        boxShadow: `0 0 ${16 + glowDensity * 22}px rgba(211,255,82,${0.1 + glowDensity * 0.14})`,
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(211,255,82,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(211,255,82,0.04) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
          opacity: 0.5,
        }}
      />
      <div className="flex items-start justify-between gap-3 relative z-10">
        <p className="text-[10px] font-cond font-bold text-volt tracking-wide-2 uppercase leading-none">
          TOTAL STRENGTH RANK
        </p>
        {demoLabel && (
          <span
            className="text-[10px] font-cond text-ink-3 leading-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--pt-6)",
              borderRadius: 999,
              padding: "4px 10px",
            }}
          >
            {demoLabel}
          </span>
        )}
      </div>
      <p
        className="font-display leading-none tabular-nums relative z-10"
        style={{
          fontSize: "clamp(56px, 14vw, 84px)",
          color: "var(--volt)",
          letterSpacing: "-0.025em",
          textShadow: `0 0 ${20 + glowDensity * 18}px rgba(211,255,82,${0.32 + glowDensity * 0.32})`,
        }}
      >
        TOP {topPct}%
      </p>
      <div className="relative z-10 flex flex-col gap-2">
        <div
          className="w-full rounded-full relative overflow-visible"
          style={{
            height: 11,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--pt-5)",
          }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${percentile}%`,
              background: "var(--grad-volt-bar)",
              boxShadow: "0 0 12px var(--volt-glow-2)",
              transition: "width 0.7s ease",
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 anim-pulse"
            style={{ left: `${percentile}%` }}
          >
            <div
              className="rounded-full"
              style={{
                width: 15,
                height: 15,
                background: "var(--volt)",
                border: "2px solid #000",
                boxShadow: "0 0 10px rgba(211,255,82,0.9)",
              }}
            />
          </div>
        </div>
        <div className="flex justify-between text-[9px] font-cond text-ink-4 leading-none tracking-wider">
          <span>NOVICE</span>
          <span>BEGINNER</span>
          <span>INTERMEDIATE</span>
          <span>ADVANCED</span>
          <span className="text-volt font-bold">ELITE</span>
        </div>
      </div>
    </div>
  );
}

/* ── Segment Control ── */
function SegmentControl({
  value,
  onChange,
}: {
  value: SubTab;
  onChange: (v: SubTab) => void;
}) {
  const ITEMS: {
    key: SubTab;
    icon: typeof Dumbbell;
    label: string;
    sub: string;
  }[] = [
    { key: "strength", icon: Dumbbell, label: "STRENGTH", sub: "근력" },
    { key: "body", icon: Activity, label: "BODY", sub: "체성분" },
    { key: "analysis", icon: BarChart3, label: "ANALYSIS", sub: "분석" },
  ];

  return (
    <div
      className="flex p-1.5 gap-1.5 rounded-2xl"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)",
      }}
    >
      {ITEMS.map(({ key, icon: Icon, label, sub }) => {
        const active = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className="tap-haptic flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all"
            style={
              active
                ? {
                    background: "rgba(255,255,255,0.09)",
                    boxShadow:
                      "0 1px 4px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
                  }
                : {}
            }
          >
            <div className="flex items-center gap-1.5">
              <Icon
                size={13}
                strokeWidth={active ? 2.5 : 2}
                style={{ color: active ? "var(--volt)" : "var(--ink-3)" }}
              />
              <span
                className="font-cond font-bold text-[11px] tracking-wider leading-none"
                style={{ color: active ? "var(--ink-0)" : "var(--ink-3)" }}
              >
                {label}
              </span>
            </div>
            <span
              className="text-[9px] font-cond leading-none"
              style={{ color: active ? "var(--ink-2)" : "var(--ink-4)" }}
            >
              {sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}
