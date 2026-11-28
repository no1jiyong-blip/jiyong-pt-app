"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  type Member,
  type Session,
  type ExerciseRecord,
  type BenchmarkData,
  type PersonalLog,
  calcOneRM,
  getAgeGroup,
} from "@/lib/types";
import { computeOneRMProgress } from "@/lib/growth";
import { TabHeader } from "@/components/member/TabHeader";
import { Confetti } from "@/components/shared/Confetti";
import { HeroSBDChart } from "@/components/shared/HeroSBDChart";
import { SupportCarousel } from "@/components/shared/SupportCarousel";
import { OneRMReportCard } from "@/components/shared/OneRMReportCard";
import { BodyMetrics } from "@/components/shared/BodyMetrics";
import { AnalysisInsights } from "@/components/shared/AnalysisInsights";

interface Props {
  member: Member;
  sessions: Session[];
  recordsBySession: Record<string, ExerciseRecord[]>;
  personalLogs: PersonalLog[];
}

type SubTab = "strength" | "body" | "analysis";

/* ─── 성별별 3대 운동 설정 ─── */
const MALE_SBD = ["스쿼트", "데드리프트", "벤치프레스"];
const FEMALE_SBD = ["스쿼트", "데드리프트", "숄더프레스"];

/* 선택 종목 등급(ACSM 벤치마크) 한글 라벨 */
const LEVEL_LABEL: Record<string, string> = {
  NOVICE: "입문",
  BEGINNER: "초급",
  INTERMEDIATE: "중급",
  ADVANCED: "상급",
  ELITE: "엘리트",
};

export function GrowthTab({
  member,
  sessions,
  recordsBySession,
  personalLogs,
}: Props) {
  const [subTab, setSubTab] = useState<SubTab>("strength");
  const [benchmarks, setBenchmarks] = useState<BenchmarkData[]>([]);
  const [confettiKey, setConfettiKey] = useState(0);

  const ageGroup = getAgeGroup(member.birth_date);
  const sbdConfig = member.gender === "female" ? FEMALE_SBD : MALE_SBD;
  const [selectedEx, setSelectedEx] = useState(sbdConfig[0]);

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
    })();
  }, [member.gender, ageGroup]);

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
    sbdConfig.forEach((name) => {
      const my = myMax.get(name) ?? 0;
      if (my <= 0) return;
      const bench = benchmarks.find((b) => b.exercise_name === name);
      if (!bench) return;
      const { beginner_kg, intermediate_kg, advanced_kg, elite_kg } = bench;
      const pct =
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
    return { avg, topPct: Math.max(1, 100 - avg), valid: percentiles.length > 0, myMax };
  }, [sessions, recordsBySession, benchmarks, sbdConfig]);

  /* 선택된 종목의 등급 (ACSM 벤치마크 기준) */
  const selectedLevel = useMemo(() => {
    const current = overall.myMax.get(selectedEx) ?? 0;
    const bench = benchmarks.find((b) => b.exercise_name === selectedEx);
    if (!bench || current <= 0) return null;
    if (current >= bench.elite_kg) return "ELITE";
    if (current >= bench.advanced_kg) return "ADVANCED";
    if (current >= bench.intermediate_kg) return "INTERMEDIATE";
    if (current >= bench.beginner_kg) return "BEGINNER";
    return "NOVICE";
  }, [overall.myMax, benchmarks, selectedEx]);

  /* 3대 운동 종목별 진행 상황 (3대 운동 합계 그리드 + 등록 대비 총 증량에 사용) */
  const liftProgress = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeOneRMProgress>>();
    sbdConfig.forEach((name) => {
      map.set(name, computeOneRMProgress(name, sessions, recordsBySession));
    });
    return map;
  }, [sbdConfig, sessions, recordsBySession]);

  const bigThreeTotal = sbdConfig.reduce(
    (sum, name) => sum + (liftProgress.get(name)?.latest?.orm ?? 0),
    0
  );
  const totalGainKg = sbdConfig.reduce((sum, name) => {
    const p = liftProgress.get(name);
    if (!p?.first || !p?.latest) return sum;
    return sum + (p.latest.orm - p.first.orm);
  }, 0);
  return (
    <div className="anim-tab-slide flex flex-col gap-7 pt-2 pb-36">
      <Confetti trigger={confettiKey} count={32} />

      {/* 헤더 */}
      <div className="px-5">
        <TabHeader title="GROWTH REPORT" subtitle="데이터로 증명되는 당신의 발전" />
      </div>

      {/* 서브탭 세그먼트 컨트롤 */}
      <div className="px-5">
        <SegmentControl value={subTab} onChange={setSubTab} />
      </div>

      {/* ─── STRENGTH 탭 ─── */}
      {subTab === "strength" && (
        <div className="flex flex-col gap-8">
          {/* ① 근력 수준 결론 요약 — 근력 탭 전용 */}
          {overall.valid && (
            <div className="px-5">
              <StrengthSummary
                topPct={overall.topPct}
                percentile={overall.avg}
                totalGainKg={totalGainKg}
              />
            </div>
          )}

          {/* ② 3대 운동 핵심 결론 — 합계 + 통합 히어로 카드 */}
          <section className="px-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-cond font-bold text-ink-0" style={{ fontSize: 15 }}>
                3대 운동 합계
              </span>
              {bigThreeTotal > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-cond font-bold text-ink-3">합산</span>
                  <span className="font-mono-num font-extrabold text-volt text-base tabular-nums">{bigThreeTotal}kg</span>
                  {totalGainKg !== 0 && (
                    <span className="font-mono-num font-bold text-[11px] text-ink-3 tabular-nums">
                      (누적 {totalGainKg > 0 ? "+" : ""}{totalGainKg}kg)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 종목 선택 — 무채색 세그먼트 */}
            <div className="grid grid-cols-3 gap-2.5">
              {sbdConfig.map((name) => {
                const active = selectedEx === name;
                const p = liftProgress.get(name);
                const change = p?.latest && p?.previous ? p.latest.orm - p.previous.orm : null;
                return (
                  <button
                    key={name}
                    onClick={() => setSelectedEx(name)}
                    className="tap-haptic p-3 rounded-2xl text-left transition-all"
                    style={
                      active
                        ? { background: "rgba(211,255,82,0.07)", border: "1px solid var(--volt-glow-2)" }
                        : { background: "var(--pt-1)", border: "1px solid var(--pt-5)" }
                    }
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-cond font-semibold text-ink-3 truncate">{name}</span>
                      {change !== null && change !== 0 && (
                        <span
                          className="font-mono-num font-bold text-[9px] px-1 rounded shrink-0 tabular-nums"
                          style={{
                            color: change > 0 ? "var(--volt)" : "var(--ink-3)",
                            background: change > 0 ? "rgba(211,255,82,0.1)" : "rgba(255,255,255,0.05)",
                          }}
                        >
                          {change > 0 ? "+" : ""}{change}kg
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-0.5">
                      <span
                        className="font-mono-num font-extrabold tabular-nums"
                        style={{ fontSize: 18, color: active ? "var(--volt)" : "var(--ink-0)" }}
                      >
                        {p?.latest?.orm ?? 0}
                      </span>
                      <span className="text-[9px] font-cond font-bold text-ink-4">kg</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 통합 히어로 카드 — 핵심 수치 + 단일 라인 추이 그래프 */}
            <div
              className="pt-card flex flex-col gap-5"
              style={{
                padding: 22,
                background: "linear-gradient(160deg, rgba(211,255,82,0.06) 0%, rgba(20,20,20,0.88) 65%)",
                borderColor: "rgba(211,255,82,0.2)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-ink-0 text-base">{selectedEx}</span>
                {selectedLevel && (
                  <span
                    className="font-cond font-bold px-2 py-0.5 rounded text-[11px] leading-none"
                    style={{ background: "rgba(211,255,82,0.1)", color: "var(--volt)", border: "1px solid var(--volt-glow-2)" }}
                  >
                    {LEVEL_LABEL[selectedLevel] ?? selectedLevel}
                  </span>
                )}
              </div>

              <OneRMReportCard
                exerciseName={selectedEx}
                sessions={sessions}
                recordsBySession={recordsBySession}
                startDate={member.session_start_date}
                goalKg={benchmarks.find((b) => b.exercise_name === selectedEx)?.advanced_kg}
                bare
              />

              <HeroSBDChart
                sessions={sessions}
                recordsBySession={recordsBySession}
                benchmarks={benchmarks}
                gender={member.gender}
                only={selectedEx}
              />
            </div>
          </section>

          {/* ③ 보조 종목 */}
          <div className="px-5">
            <SupportCarousel
              sessions={sessions}
              recordsBySession={recordsBySession}
              excludeNames={sbdConfig}
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

      <div style={{ height: 12 }} />
    </div>
  );
}

/* ── 근력 수준 결론 요약 (근력 탭 전용) ── */
function StrengthSummary({
  topPct,
  percentile,
  totalGainKg,
}: {
  topPct: number;
  percentile: number;
  totalGainKg: number;
}) {
  return (
    <div
      className="pt-card flex flex-col gap-3"
      style={{
        padding: 20,
        background: "linear-gradient(160deg, rgba(211,255,82,0.07) 0%, rgba(20,20,20,0.88) 65%)",
        borderColor: "var(--volt-glow-2)",
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-cond font-bold text-ink-0" style={{ fontSize: 14 }}>
          근력 수준
        </span>
        <span
          className="font-display tabular-nums leading-none"
          style={{ fontSize: 32, color: "var(--volt)", textShadow: "0 0 14px var(--volt-glow-2)" }}
        >
          TOP {topPct}%
        </span>
      </div>
      <p className="text-xs text-ink-1 leading-relaxed">
        3대 운동 기준 상위{" "}
        <span className="font-bold" style={{ color: "var(--volt)" }}>
          {topPct}%
        </span>{" "}
        수준이며, 등록 대비{" "}
        <span className="font-bold" style={{ color: "var(--volt)" }}>
          {totalGainKg > 0 ? "+" : ""}{totalGainKg}kg
        </span>{" "}
        성장했습니다.
      </p>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: 6, background: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${percentile}%`,
            background: "var(--volt)",
            transition: "width 0.7s ease",
          }}
        />
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
  const ITEMS: { key: SubTab; label: string }[] = [
    { key: "strength", label: "근력" },
    { key: "body", label: "체성분" },
    { key: "analysis", label: "출석" },
  ];

  return (
    <div
      className="flex p-1 gap-1 rounded-xl"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {ITEMS.map(({ key, label }) => {
        const active = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className="tap-haptic flex-1 py-2.5 rounded-lg transition-all font-cond font-bold text-sm"
            style={
              active
                ? { background: "rgba(255,255,255,0.09)", color: "var(--ink-0)" }
                : { color: "var(--ink-3)" }
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
