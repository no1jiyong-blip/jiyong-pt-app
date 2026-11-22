"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Target, Zap, Flame, Activity } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import { supabase } from "@/lib/supabase";
import type { BodyMeasurement } from "@/lib/types";
import { getAge } from "@/lib/types";

/* ─── ACSM 체지방률 등급 기준 (성별/연령) ──────────── */
const ACSM_BF: Record<
  "male" | "female",
  Record<"20s" | "30s" | "40s" | "50s", { elite: number; good: number; fair: number }>
> = {
  male: {
    "20s": { elite: 10, good: 20, fair: 25 },
    "30s": { elite: 12, good: 22, fair: 27 },
    "40s": { elite: 14, good: 24, fair: 29 },
    "50s": { elite: 16, good: 26, fair: 31 },
  },
  female: {
    "20s": { elite: 18, good: 26, fair: 32 },
    "30s": { elite: 20, good: 28, fair: 33 },
    "40s": { elite: 22, good: 30, fair: 35 },
    "50s": { elite: 24, good: 32, fair: 37 },
  },
};

/* 목표 골격근량 기준 (성별) */
const TARGET_SMM: Record<"male" | "female", { elite: number; good: number; fair: number }> = {
  male:   { elite: 38, good: 35, fair: 32 },
  female: { elite: 26, good: 23, fair: 21 },
};

/* 복부지방률(WHR) 기준 — WHO 허리엉덩이둘레비 위험기준(남 0.90 / 여 0.85)을 Elite~Fair 3단계로 세분화 */
const WHR_BANDS: Record<"male" | "female", { elite: number; good: number; fair: number }> = {
  male:   { elite: 0.85, good: 0.90, fair: 0.95 },
  female: { elite: 0.78, good: 0.85, fair: 0.90 },
};

/**
 * Elite/Good/Fair 3단계 기준치를 0~100 연속 퍼센타일로 변환 (GrowthTab의 벤치마크 보간 방식과 동일한 원리).
 * higherIsBetter=false면 값이 낮을수록 좋은 지표(체지방률·WHR 등)로 취급.
 */
function gradePercentile(
  value: number,
  elite: number,
  good: number,
  fair: number,
  higherIsBetter: boolean
): number {
  const dir = higherIsBetter ? 1 : -1;
  const e = elite * dir, gBand = good * dir, f = fair * dir, v = value * dir;
  if (v >= e) return 99;
  if (v >= gBand) return 75 + ((v - gBand) / Math.max(1e-6, e - gBand)) * 24;
  if (v >= f) return 50 + ((v - f) / Math.max(1e-6, gBand - f)) * 25;
  return Math.max(1, (v / Math.max(1e-6, f)) * 50);
}

type ACSMGrade = "Elite" | "Good" | "Fair" | "Poor";

function getGrade(
  bodyFatPct: number,
  gender: "male" | "female",
  ageGroup: "20s" | "30s" | "40s" | "50s"
): ACSMGrade {
  const ref = ACSM_BF[gender][ageGroup];
  if (bodyFatPct <= ref.elite) return "Elite";
  if (bodyFatPct <= ref.good)  return "Good";
  if (bodyFatPct <= ref.fair)  return "Fair";
  return "Poor";
}

const GRADE_META: Record<ACSMGrade, { color: string; bg: string; border: string; topPct: string; desc: string }> = {
  Elite: {
    color: "#D3FF52", bg: "rgba(211,255,82,0.10)", border: "rgba(211,255,82,0.30)",
    topPct: "상위 20%",
    desc: "전 세계 운동 인구 중 최상위권. 낮은 체지방률과 높은 근육 밀도를 가진 모델·운동선수 수준의 몸입니다.",
  },
  Good: {
    color: "#5BA8FF", bg: "rgba(91,168,255,0.10)", border: "rgba(91,168,255,0.30)",
    topPct: "상위 20~40%",
    desc: "일반인 중 상당히 관리가 잘 된 편. 근육의 윤곽이 보이기 시작하며 건강미가 넘치는 수준입니다.",
  },
  Fair: {
    color: "#ff8c00", bg: "rgba(255,140,0,0.10)", border: "rgba(255,140,0,0.30)",
    topPct: "상위 40~60%",
    desc: "가장 일반적인 수준. 건강을 위해 근육량 증가와 체지방 관리가 동시에 필요한 단계입니다.",
  },
  Poor: {
    color: "#ff5577", bg: "rgba(255,85,119,0.10)", border: "rgba(255,85,119,0.30)",
    topPct: "상위 60% 이상",
    desc: "활동량이 부족한 상태. 근감소 예방과 체지방 컷팅이 시급한 건강 관리 주의 단계입니다.",
  },
};

interface Props {
  memberId?: string;
  gender?: "male" | "female" | null;
  age?: string | null; // birth_date
}

export function BodyMetrics({ memberId, gender, age }: Props) {
  const [history, setHistory] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [trendPeriod, setTrendPeriod] = useState<"1M" | "3M" | "ALL">("3M");
  const [trendMetric, setTrendMetric] = useState<"skeletal_muscle_kg" | "body_fat_pct" | "weight_kg">(
    "skeletal_muscle_kg"
  );

  const ageNum = getAge(age ?? null);
  const ageGroup: "20s" | "30s" | "40s" | "50s" =
    !ageNum ? "30s"
    : ageNum < 30 ? "20s"
    : ageNum < 40 ? "30s"
    : ageNum < 50 ? "40s"
    : "50s";

  const g = gender ?? "male";

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("body_measurements")
        .select("*")
        .eq("member_id", memberId)
        .order("measured_at", { ascending: true });
      setHistory((data ?? []) as BodyMeasurement[]);
      setLoading(false);
    })();
  }, [memberId]);

  const latest = history[history.length - 1] ?? null;
  const first   = history[0] ?? null;

  const grade = latest?.body_fat_pct != null
    ? getGrade(latest.body_fat_pct, g, ageGroup)
    : null;
  const gradeMeta = grade ? GRADE_META[grade] : null;

  /* 목표값 계산 (Good 등급 기준) */
  const targetBF  = ACSM_BF[g][ageGroup].good;
  const targetSMM = TARGET_SMM[g].good;

  const needMuscleDelta = latest?.skeletal_muscle_kg != null
    ? Math.max(0, Math.round((targetSMM - latest.skeletal_muscle_kg) * 10) / 10)
    : null;
  const needFatDelta = latest?.body_fat_pct != null
    ? Math.max(0, Math.round((latest.body_fat_pct - targetBF) * 10) / 10)
    : null;

  /* 예상 타임라인 */
  const timeline = useMemo(() => {
    if (!needMuscleDelta && !needFatDelta) return null;
    // 근육: 월 평균 0.5~1kg 증가 가능
    const muscleMonths = needMuscleDelta && needMuscleDelta > 0 ? Math.ceil(needMuscleDelta / 0.7) : 0;
    // 체지방: 월 평균 0.5~1% 감소 가능
    const fatMonths = needFatDelta && needFatDelta > 0 ? Math.ceil(needFatDelta / 0.6) : 0;
    return Math.max(muscleMonths, fatMonths);
  }, [needMuscleDelta, needFatDelta]);

  /* 차트 데이터 */
  const chartData = history.map((h) => ({
    date: h.measured_at.slice(5),
    근육: h.skeletal_muscle_kg ?? 0,
    체지방률: h.body_fat_pct ?? 0,
    체지방량: h.body_fat_kg ?? 0,
    체중: h.weight_kg ?? 0,
  }));

  /* 지표별 0~100 퍼센타일 — 실측 기준치(TARGET_SMM/ACSM_BF/WHR_BANDS) 기반, 가짜 수치 없음 */
  const smmPercentile = latest?.skeletal_muscle_kg != null
    ? gradePercentile(latest.skeletal_muscle_kg, TARGET_SMM[g].elite, TARGET_SMM[g].good, TARGET_SMM[g].fair, true)
    : null;
  const bfPercentile = latest?.body_fat_pct != null
    ? gradePercentile(latest.body_fat_pct, ACSM_BF[g][ageGroup].elite, ACSM_BF[g][ageGroup].good, ACSM_BF[g][ageGroup].fair, false)
    : null;
  const whrPercentile = latest?.whr != null
    ? gradePercentile(latest.whr, WHR_BANDS[g].elite, WHR_BANDS[g].good, WHR_BANDS[g].fair, false)
    : null;
  const fatKgPercentile = (latest?.body_fat_kg != null && latest?.weight_kg)
    ? gradePercentile(
        latest.body_fat_kg,
        (latest.weight_kg * ACSM_BF[g][ageGroup].elite) / 100,
        (latest.weight_kg * ACSM_BF[g][ageGroup].good) / 100,
        (latest.weight_kg * ACSM_BF[g][ageGroup].fair) / 100,
        false
      )
    : null;

  /* 체중/BMR은 성별·연령 표준치가 없어 "개인 측정 기록 내 위치"로 대체 (표준 아님, 과장 금지) */
  function personalRangePercent(key: "weight_kg" | "bmr_kcal"): number | null {
    const vals = history.map((h) => h[key]).filter((v): v is number => v != null);
    const cur = latest?.[key];
    if (vals.length < 2 || cur == null) return null;
    const lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi === lo) return 50;
    return Math.round(((cur - lo) / (hi - lo)) * 100);
  }
  const weightRangePct = personalRangePercent("weight_kg");
  const bmrRangePct = personalRangePercent("bmr_kcal");

  /* BODY TREND 섹션 — 기간 필터링 */
  const trendHistory = useMemo(() => {
    if (trendPeriod === "ALL" || history.length === 0) return history;
    const days = trendPeriod === "1M" ? 30 : 90;
    const cutoff = new Date(history[history.length - 1].measured_at);
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const filtered = history.filter((h) => h.measured_at >= cutoffStr);
    return filtered.length >= 2 ? filtered : history;
  }, [history, trendPeriod]);

  /* 순수 리컴포지션 여부 판정 (근육 증가 + 체지방 감소 동시 달성) */
  const muscleDeltaTotal = latest?.skeletal_muscle_kg != null && first?.skeletal_muscle_kg != null
    ? Math.round((latest.skeletal_muscle_kg - first.skeletal_muscle_kg) * 10) / 10
    : null;
  const fatDeltaTotal = latest?.body_fat_kg != null && first?.body_fat_kg != null
    ? Math.round((latest.body_fat_kg - first.body_fat_kg) * 10) / 10
    : null;
  const recompLabel =
    muscleDeltaTotal == null || fatDeltaTotal == null ? null
    : muscleDeltaTotal > 0 && fatDeltaTotal < 0 ? "순수 리컴포지션"
    : muscleDeltaTotal > 0 && fatDeltaTotal >= 0 ? "벌크업 진행 중"
    : muscleDeltaTotal <= 0 && fatDeltaTotal < 0 ? "체지방 감량 중"
    : "변화 적음";

  if (loading) {
    return (
      <div className="py-12 text-center">
        <p className="text-ink-3 font-cond anim-pulse text-sm">데이터 불러오는 중...</p>
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="pt-card text-center" style={{ padding: 28 }}>
        <p className="text-ink-3 font-cond text-sm leading-relaxed">
          아직 인바디 측정 기록이 없습니다.
          <br />트레이너에게 측정값 입력을 요청하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">

      {/* ─── 1. ACSM 등급 카드 ─── */}
      {grade && gradeMeta && (
        <section className="flex flex-col gap-4">
          <SectionTitle en="ACSM GRADE" ko="체성분 등급" />

          <div
            className="pt-card flex flex-col gap-5"
            style={{
              padding: 24,
              background: `linear-gradient(160deg, ${gradeMeta.bg} 0%, rgba(20,20,20,0.88) 70%)`,
              borderColor: gradeMeta.border,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-2">
                <p
                  className="font-display leading-none uppercase"
                  style={{ fontSize: 42, color: gradeMeta.color, letterSpacing: "-0.02em" }}
                >
                  {grade}
                </p>
                <p
                  className="text-[11px] font-cond font-bold leading-none"
                  style={{ color: gradeMeta.color }}
                >
                  {gradeMeta.topPct}
                </p>
              </div>
              <div
                className="px-3 py-1.5 rounded-full text-[10px] font-cond leading-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--pt-6)",
                  color: "var(--ink-2)",
                }}
              >
                {g === "male" ? "남성" : "여성"} · {ageGroup} · ACSM 기준
              </div>
            </div>

            <p className="text-sm text-ink-1 leading-relaxed">{gradeMeta.desc}</p>

            {/* 동년배 대비 3대 퍼센타일 요약 칩 (TARGET_SMM/ACSM_BF/WHR_BANDS 실측 기준치 보간) */}
            {(smmPercentile != null || bfPercentile != null || whrPercentile != null) && (
              <div className="grid grid-cols-3 gap-2">
                {smmPercentile != null && (
                  <PercentileChip label="골격근 수준" topPct={Math.max(1, Math.round(100 - smmPercentile))} color="var(--volt)" />
                )}
                {bfPercentile != null && (
                  <PercentileChip label="체지방 수준" topPct={Math.max(1, Math.round(100 - bfPercentile))} color="var(--info)" />
                )}
                {whrPercentile != null && (
                  <PercentileChip label="복부지방 수준" topPct={Math.max(1, Math.round(100 - whrPercentile))} color="var(--ink-0)" />
                )}
              </div>
            )}

            {/* 체지방률 게이지 */}
            {latest.body_fat_pct != null && (
              <BFGauge
                value={latest.body_fat_pct}
                gender={g}
                ageGroup={ageGroup}
                color={gradeMeta.color}
              />
            )}

            {/* 동일 연령대 표준 비교표 */}
            <BenchmarkTable
              gender={g}
              ageGroup={ageGroup}
              smmKg={latest.skeletal_muscle_kg}
              bfPct={latest.body_fat_pct}
              whr={latest.whr}
            />
          </div>
        </section>
      )}

      {/* ─── 2. BODY TREND — 기간별 체성분 변화 추이 ─── */}
      {history.length >= 2 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle en="BODY TREND" ko="기간별 체성분 누적 변화 추이" />
            <div
              className="flex gap-1 p-1 rounded-xl shrink-0"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              {(["1M", "3M", "ALL"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTrendPeriod(p)}
                  className="tap-haptic px-2.5 py-1 rounded-lg text-[10px] font-cond font-bold transition-all"
                  style={
                    trendPeriod === p
                      ? { background: "rgba(255,255,255,0.10)", color: "var(--ink-0)" }
                      : { color: "var(--ink-3)" }
                  }
                >
                  {p === "1M" ? "1개월" : p === "3M" ? "3개월" : "전체"}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-card flex flex-col gap-4" style={{ padding: 20 }}>
            {/* 지표 전환 탭 */}
            <div className="grid grid-cols-3 gap-2">
              <TrendTab
                active={trendMetric === "skeletal_muscle_kg"}
                onClick={() => setTrendMetric("skeletal_muscle_kg")}
                label="골격근량"
                value={latest.skeletal_muscle_kg}
                unit="kg"
                delta={muscleDeltaTotal != null ? muscleDeltaTotal : null}
                color="var(--volt)"
              />
              <TrendTab
                active={trendMetric === "body_fat_pct"}
                onClick={() => setTrendMetric("body_fat_pct")}
                label="체지방률"
                value={latest.body_fat_pct}
                unit="%"
                delta={
                  latest.body_fat_pct != null && first?.body_fat_pct != null
                    ? Math.round((latest.body_fat_pct - first.body_fat_pct) * 10) / 10
                    : null
                }
                color="var(--info)"
              />
              <TrendTab
                active={trendMetric === "weight_kg"}
                onClick={() => setTrendMetric("weight_kg")}
                label="체중"
                value={latest.weight_kg}
                unit="kg"
                delta={
                  latest.weight_kg != null && first?.weight_kg != null
                    ? Math.round((latest.weight_kg - first.weight_kg) * 10) / 10
                    : null
                }
                color="var(--ink-0)"
              />
            </div>

            {/* 추이 차트 */}
            <ResponsiveContainer width="100%" height={176}>
              <AreaChart data={trendHistory} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="bodyTrendGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={trendMetric === "skeletal_muscle_kg" ? "#D3FF52" : trendMetric === "body_fat_pct" ? "#4488ff" : "#cbd5e1"}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor={trendMetric === "skeletal_muscle_kg" ? "#D3FF52" : trendMetric === "body_fat_pct" ? "#4488ff" : "#cbd5e1"}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey={(d: BodyMeasurement) => d.measured_at.slice(5)}
                  tick={{ fill: "#555", fontSize: 10, fontFamily: "Barlow Condensed" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={["dataMin - 1", "dataMax + 1"]}
                  tick={{ fill: "#555", fontSize: 10, fontFamily: "Barlow Condensed" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(8,8,8,0.95)",
                    border: "1px solid #333",
                    borderRadius: 10,
                    fontFamily: "Barlow Condensed",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={trendMetric}
                  stroke={trendMetric === "skeletal_muscle_kg" ? "#D3FF52" : trendMetric === "body_fat_pct" ? "#4488ff" : "#cbd5e1"}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#bodyTrendGlow)"
                  dot={{
                    r: 3.5,
                    fill: trendMetric === "skeletal_muscle_kg" ? "#D3FF52" : trendMetric === "body_fat_pct" ? "#4488ff" : "#cbd5e1",
                    stroke: "#080808",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* 누적 변화 요약 배너 */}
            {recompLabel && (
              <div
                className="flex items-center justify-between gap-3 pt-3 text-xs"
                style={{ borderTop: "1px solid var(--pt-5)" }}
              >
                <span className="text-ink-3 font-cond">{first!.measured_at.slice(5)} 최초 측정 대비</span>
                <span className="font-bold text-ink-0">
                  근육{" "}
                  <span style={{ color: "var(--volt)" }} className="font-black">
                    {muscleDeltaTotal! > 0 ? "+" : ""}{muscleDeltaTotal}kg
                  </span>{" "}
                  · 체지방{" "}
                  <span style={{ color: "var(--info)" }} className="font-black">
                    {fatDeltaTotal! > 0 ? "+" : ""}{fatDeltaTotal}kg
                  </span>{" "}
                  {recompLabel}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── 3. 6종 지표 카드 ─── */}
      <section className="flex flex-col gap-4">
        <SectionTitle en="INBODY METRICS" ko="체성분 주요 지표" />

        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            icon={<Activity size={13} />}
            label="체중"
            value={latest.weight_kg}
            unit="kg"
            prevValue={first?.weight_kg}
            color="#cbd5e1"
            inverse
            expandable
            isExpanded={expandedIdx === 0}
            onToggle={() => setExpandedIdx(expandedIdx === 0 ? null : 0)}
            historyData={chartData}
            historyKey="체중"
            rangePercent={weightRangePct}
            rangeCaptions={["최저", "최근 변화폭", "최고"]}
          />
          <MetricCard
            icon={<Zap size={13} />}
            label="골격근량"
            value={latest.skeletal_muscle_kg}
            unit="kg"
            prevValue={first?.skeletal_muscle_kg}
            color="#D3FF52"
            expandable
            isExpanded={expandedIdx === 1}
            onToggle={() => setExpandedIdx(expandedIdx === 1 ? null : 1)}
            historyData={chartData}
            historyKey="근육"
            rangePercent={smmPercentile}
          />
          <MetricCard
            icon={<Flame size={13} />}
            label="체지방량"
            value={latest.body_fat_kg}
            unit="kg"
            prevValue={first?.body_fat_kg}
            color="#ff8c00"
            inverse
            expandable
            isExpanded={expandedIdx === 2}
            onToggle={() => setExpandedIdx(expandedIdx === 2 ? null : 2)}
            historyData={chartData}
            historyKey="체지방량"
            rangePercent={fatKgPercentile}
          />
          <MetricCard
            icon={<Flame size={13} />}
            label="체지방률"
            value={latest.body_fat_pct}
            unit="%"
            prevValue={first?.body_fat_pct}
            color="#ff5577"
            inverse
            expandable
            isExpanded={expandedIdx === 3}
            onToggle={() => setExpandedIdx(expandedIdx === 3 ? null : 3)}
            historyData={chartData}
            historyKey="체지방률"
            rangePercent={bfPercentile}
          />
          <MetricCard
            icon={<Target size={13} />}
            label="복부지방률 WHR"
            value={latest.whr}
            unit=""
            prevValue={first?.whr}
            color="#8c78ff"
            inverse
            expandable={false}
            rangePercent={whrPercentile}
          />
          <MetricCard
            icon={<Zap size={13} />}
            label="기초대사량 BMR"
            value={latest.bmr_kcal}
            unit="kcal"
            prevValue={first?.bmr_kcal}
            color="#5BA8FF"
            expandable={false}
            rangePercent={bmrRangePct}
            rangeCaptions={["최저", "최근 변화폭", "최고"]}
          />
        </div>
      </section>

      {/* ─── 4. 수준 격차 분석 (Gap Analysis) ─── */}
      {grade && grade !== "Elite" && latest.skeletal_muscle_kg != null && latest.body_fat_pct != null && (
        <section className="flex flex-col gap-4">
          <SectionTitle en="GAP ANALYSIS" ko="다음 등급까지 격차 분석" />
          <GapAnalysis
            grade={grade}
            gender={g}
            ageGroup={ageGroup}
            currentSMM={latest.skeletal_muscle_kg}
            currentBFPct={latest.body_fat_pct}
            currentWeight={latest.weight_kg ?? 70}
          />
        </section>
      )}

      {/* ─── 5. 목표 달성 게이지 ─── */}
      {(needMuscleDelta !== null || needFatDelta !== null) && (
        <section className="flex flex-col gap-4">
          <SectionTitle en="GOAL PROGRESS" ko="목표 달성 게이지" />
          <div className="pt-card flex flex-col gap-5" style={{ padding: 22 }}>
            {latest.skeletal_muscle_kg != null && (
              <GoalGauge
                label="골격근량 목표"
                current={latest.skeletal_muscle_kg}
                target={targetSMM}
                unit="kg"
                color="#D3FF52"
                higher
              />
            )}
            {latest.body_fat_pct != null && (
              <GoalGauge
                label="체지방률 목표"
                current={latest.body_fat_pct}
                target={targetBF}
                unit="%"
                color="#ff8c00"
                higher={false}
              />
            )}
            {timeline && (
              <div
                className="rounded-2xl p-4 border text-center"
                style={{
                  background: "rgba(211,255,82,0.05)",
                  borderColor: "var(--volt-glow-2)",
                }}
              >
                <p className="text-[10px] font-cond text-ink-3 tracking-wider uppercase leading-none mb-2">
                  예상 목표 달성 기간
                </p>
                <p
                  className="font-display leading-none"
                  style={{ fontSize: 32, color: "var(--volt)" }}
                >
                  약 {timeline}개월
                </p>
                <p className="text-[10px] font-cond text-ink-3 mt-2 leading-relaxed">
                  현재 운동 빈도 유지 기준 (주 2~3회)
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── 6. ACSM 액션 가이드 ─── */}
      {grade && (
        <section className="flex flex-col gap-4">
          <SectionTitle en="ACTION GUIDE" ko="신지용 트레이너 맞춤 행동 강령" />
          <ACSMActionGuide
            grade={grade}
            gender={g}
            needMuscleKg={needMuscleDelta ?? 0}
            needFatPct={needFatDelta ?? 0}
            currentWeight={latest.weight_kg ?? 70}
          />
        </section>
      )}

    </div>
  );
}

/* ═══════════════════════════════════════
   서브 컴포넌트
   ═══════════════════════════════════════ */

function SectionTitle({ en, ko }: { en: string; ko: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3
        className="font-display text-ink-0 leading-none tracking-wide uppercase"
        style={{ fontSize: 20 }}
      >
        {en}
      </h3>
      <p className="text-[11px] font-cond text-ink-3 leading-none">{ko}</p>
    </div>
  );
}

/* 동년배 대비 퍼센타일 요약 칩 (HERO 카드용) */
function PercentileChip({ label, topPct, color }: { label: string; topPct: number; color: string }) {
  return (
    <div
      className="rounded-2xl p-2.5 text-center"
      style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <span className="text-[10px] font-cond font-bold text-ink-3 block leading-none mb-1">{label}</span>
      <span className="font-mono-num font-black text-sm" style={{ color }}>상위 {topPct}%</span>
    </div>
  );
}

/* BODY TREND 지표 전환 탭 */
function TrendTab({
  active, onClick, label, value, unit, delta, color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  value: number | null | undefined;
  unit: string;
  delta: number | null;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap-haptic p-2.5 rounded-2xl text-left transition-all"
      style={
        active
          ? { background: `${color}1A`, border: `1px solid ${color}50` }
          : { background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }
      }
    >
      <span className="text-[10px] font-cond font-bold text-ink-3 block leading-none">{label}</span>
      <div className="flex items-baseline justify-between mt-1 gap-1">
        <span className="font-mono-num font-extrabold text-ink-0 text-sm leading-none">
          {value != null ? value : "—"}{unit}
        </span>
        {delta != null && (
          <span className="font-mono-num font-bold text-[10px] leading-none shrink-0" style={{ color }}>
            {delta > 0 ? "+" : ""}{delta}{unit}
          </span>
        )}
      </div>
    </button>
  );
}

/* 개별 지표 카드 */
function MetricCard({
  icon, label, value, unit, prevValue, color, inverse = false,
  expandable = false, isExpanded = false, onToggle,
  historyData, historyKey,
  rangePercent, rangeCaptions,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null | undefined;
  unit: string;
  prevValue: number | null | undefined;
  color: string;
  inverse?: boolean;
  expandable?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  historyData?: { date: string; [key: string]: string | number }[];
  historyKey?: string;
  /** 0~100: 표준 범위(또는 개인 기록 범위) 내 현재 위치 — 없으면 트랙 미표시 */
  rangePercent?: number | null;
  /** 트랙 하단 3단 캡션 (기본: 표준이하/표준/표준이상) */
  rangeCaptions?: [string, string, string];
}) {
  const delta =
    value != null && prevValue != null ? Math.round((value - prevValue) * 10) / 10 : null;
  const isPositive = delta !== null ? (inverse ? delta < 0 : delta > 0) : null;
  const deltaColor =
    delta === 0 ? "var(--ink-3)"
    : isPositive ? "#D3FF52"
    : "#ff8080";

  return (
    <div
      className="pt-card flex flex-col gap-2.5 cursor-pointer"
      style={{ padding: 18 }}
      onClick={expandable && onToggle ? onToggle : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-cond text-ink-3 tracking-wider leading-none uppercase">{label}</p>
        <div style={{ color }}>{icon}</div>
      </div>
      <p
        className="font-display tabular-nums leading-none"
        style={{ fontSize: 28, color: "var(--ink-0)", letterSpacing: "-0.02em" }}
      >
        {value != null ? value : "—"}
        {value != null && unit && (
          <span className="text-ink-3 text-sm font-cond ml-1">{unit}</span>
        )}
      </p>
      {delta !== null && (
        <p
          className="text-[10px] font-cond font-bold leading-none tabular-nums"
          style={{ color: deltaColor }}
        >
          {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}{unit} <span className="text-ink-4">· 시작 대비</span>
        </p>
      )}
      {rangePercent != null && (
        <div className="mb-0.5">
          <div className="w-full rounded-full relative overflow-hidden" style={{ height: 6, background: "var(--pt-4)" }}>
            <div
              className="absolute top-0 bottom-0 rounded-full"
              style={{ width: 4, left: `${Math.max(0, Math.min(96, rangePercent))}%`, background: color, boxShadow: `0 0 6px ${color}` }}
            />
          </div>
          <div className="flex justify-between text-[8px] font-cond text-ink-4 mt-1">
            <span>{(rangeCaptions ?? ["표준이하", "표준", "표준이상"])[0]}</span>
            <span>{(rangeCaptions ?? ["표준이하", "표준", "표준이상"])[1]}</span>
            <span>{(rangeCaptions ?? ["표준이하", "표준", "표준이상"])[2]}</span>
          </div>
        </div>
      )}
      {expandable && (
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[9px] font-cond text-ink-4 leading-none">
            {isExpanded ? "히스토리 닫기" : "히스토리 보기"}
          </span>
          {isExpanded ? <ChevronUp size={10} className="text-ink-4" /> : <ChevronDown size={10} className="text-ink-4" />}
        </div>
      )}
      {isExpanded && historyData && historyKey && historyData.length >= 2 && (
        <div className="mt-2 pt-2 border-t border-pt-5">
          <ResponsiveContainer width="100%" height={70}>
            <LineChart data={historyData} margin={{ top: 4, right: 2, left: -30, bottom: 0 }}>
              <Line type="monotone" dataKey={historyKey} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/**
 * 동년배 표준 기준 비교표 — 내 수치 / 추정 평균 / 이상적 기준(Good 등급) / 평균 대비
 * "추정 평균"은 실측 인구 평균이 아니라 ACSM/WHO Good~Fair 구간의 중간값으로 근사한 값
 * (과장 방지를 위해 표 하단에 근거를 명시)
 */
function BenchmarkTable({
  gender, ageGroup, smmKg, bfPct, whr,
}: {
  gender: "male" | "female";
  ageGroup: "20s" | "30s" | "40s" | "50s";
  smmKg: number | null;
  bfPct: number | null;
  whr: number | null;
}) {
  const bfRef = ACSM_BF[gender][ageGroup];
  const smmRef = TARGET_SMM[gender];
  const whrRef = WHR_BANDS[gender];

  const rows: {
    key: string;
    label: string;
    current: number | null;
    unit: string;
    avgEstimate: number;
    ideal: string;
    higherIsBetter: boolean;
  }[] = [
    {
      key: "smm",
      label: "골격근량",
      current: smmKg,
      unit: "kg",
      // Fair 기준치보다 약간 낮은 지점을 "일반 평균"으로 근사 (퍼센타일 칩의 50% 기준점과 정합성 유지)
      avgEstimate: Math.round((smmRef.fair - (smmRef.good - smmRef.fair) / 3) * 10) / 10,
      ideal: `${smmRef.good}kg 이상`,
      higherIsBetter: true,
    },
    {
      key: "bf",
      label: "체지방률",
      current: bfPct,
      unit: "%",
      avgEstimate: Math.round(((bfRef.good + bfRef.fair) / 2) * 10) / 10,
      ideal: `${bfRef.elite}~${bfRef.good}%`,
      higherIsBetter: false,
    },
    {
      key: "whr",
      label: "복부지방률",
      current: whr,
      unit: "",
      avgEstimate: Math.round(((whrRef.good + whrRef.fair) / 2) * 100) / 100,
      ideal: `${whrRef.good} 이하`,
      higherIsBetter: false,
    },
  ];

  const visibleRows = rows.filter((r) => r.current != null);
  if (visibleRows.length === 0) return null;

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "rgba(0,0,0,0.4)", border: "1px solid var(--pt-5)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-cond font-black text-ink-0 tracking-wide">
          동일 연령대 표준 비교표
        </span>
        <span className="text-[10px] font-cond text-ink-4">
          {ageGroup.replace("s", "")}대 {gender === "male" ? "남성" : "여성"} · ACSM 기준
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[9px] font-cond font-bold text-ink-4" style={{ borderBottom: "1px solid var(--pt-5)" }}>
              <th className="pb-2 font-bold">항목</th>
              <th className="pb-2 text-right font-bold">내 수치</th>
              <th className="pb-2 text-right font-bold">추정 평균</th>
              <th className="pb-2 text-right font-bold">이상적 기준</th>
              <th className="pb-2 text-right font-bold">평균 대비</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const diff = Math.round(((row.current as number) - row.avgEstimate) * 100) / 100;
              const isBetter = row.higherIsBetter ? diff > 0 : diff < 0;
              const diffColor = diff === 0 ? "var(--ink-3)" : isBetter ? "var(--volt)" : "#ff8080";
              return (
                <tr key={row.key} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td className="py-2 text-xs font-cond font-bold text-ink-2">{row.label}</td>
                  <td className="py-2 text-right font-mono-num font-black text-ink-0 text-xs">
                    {row.current}{row.unit}
                  </td>
                  <td className="py-2 text-right font-mono-num text-ink-3 text-xs">
                    {row.avgEstimate}{row.unit}
                  </td>
                  <td className="py-2 text-right font-mono-num text-ink-2 text-xs">{row.ideal}</td>
                  <td className="py-2 text-right">
                    <span
                      className="inline-block text-[10px] font-mono-num font-bold px-2 py-0.5 rounded"
                      style={{ background: `${diffColor}1A`, color: diffColor }}
                    >
                      {diff > 0 ? "+" : ""}{diff}{row.unit}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[9px] font-cond text-ink-4 leading-relaxed mt-2.5">
        ※ 추정 평균은 ACSM/WHO 등급 구간(Good~Fair)의 중간값으로 근사한 값이며, 실측 인구 평균 통계가 아닙니다.
      </p>
    </div>
  );
}

/* 체지방률 게이지 */
function BFGauge({
  value, gender, ageGroup, color,
}: {
  value: number;
  gender: "male" | "female";
  ageGroup: "20s" | "30s" | "40s" | "50s";
  color: string;
}) {
  const ref = ACSM_BF[gender][ageGroup];
  const maxBF = ref.fair + 8;
  const pct = Math.min(100, (value / maxBF) * 100);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-cond text-ink-3 uppercase tracking-wider leading-none">
          체지방률 위치
        </p>
        <p className="font-display leading-none tabular-nums" style={{ fontSize: 18, color }}>
          {value}%
        </p>
      </div>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: 12, background: "linear-gradient(90deg, #D3FF52 0%, #ff8c00 55%, #ff5577 100%)", border: "1px solid var(--pt-5)" }}
      >
        <div
          className="h-full flex justify-end items-center pr-1"
          style={{
            width: `${pct}%`,
            background: "rgba(0,0,0,0.0)",
          }}
        >
          <div
            className="rounded-full shrink-0"
            style={{ width: 14, height: 14, background: "#fff", border: "2px solid #000", boxShadow: `0 0 8px ${color}` }}
          />
        </div>
      </div>
      <div className="flex justify-between text-[9px] font-cond text-ink-3 leading-none">
        <span className="text-volt font-bold">Elite ≤{ref.elite}%</span>
        <span>Good ≤{ref.good}%</span>
        <span>Fair ≤{ref.fair}%</span>
        <span className="text-danger">Poor</span>
      </div>
    </div>
  );
}

/* 격차 분석 (중첩 막대) */
function GapAnalysis({
  grade, gender, ageGroup, currentSMM, currentBFPct,
}: {
  grade: ACSMGrade;
  gender: "male" | "female";
  ageGroup: "20s" | "30s" | "40s" | "50s";
  currentSMM: number;
  currentBFPct: number;
  currentWeight: number;
}) {
  const nextGrade: ACSMGrade =
    grade === "Poor" ? "Fair" : grade === "Fair" ? "Good" : "Elite";
  const nextMeta = GRADE_META[nextGrade];

  const targetBF  = ACSM_BF[gender][ageGroup][nextGrade.toLowerCase() as "elite" | "good" | "fair"];
  const targetSMM = TARGET_SMM[gender][nextGrade.toLowerCase() as "elite" | "good" | "fair"];

  const smmDelta = Math.max(0, Math.round((targetSMM - currentSMM) * 10) / 10);
  const bfDelta  = Math.max(0, Math.round((currentBFPct - targetBF) * 10) / 10);

  const chartData = [
    {
      label: "골격근량 (kg)",
      현재: currentSMM,
      목표: targetSMM,
    },
    {
      label: "체지방률 (%)",
      현재: currentBFPct,
      목표: targetBF,
    },
  ];

  // 칼로리 계산
  const calDeficit = Math.round(bfDelta * 7700 / 120); // 체지방 1% ≈ 체중의 1% ≈ 칼로리

  return (
    <div className="flex flex-col gap-4">
      <div
        className="pt-card flex flex-col gap-4"
        style={{
          padding: 22,
          background: `linear-gradient(160deg, ${nextMeta.bg} 0%, rgba(20,20,20,0.88) 70%)`,
          borderColor: nextMeta.border,
        }}
      >
        <div className="flex items-center gap-3">
          <p className="text-[10px] font-cond text-ink-3 leading-none">다음 목표 등급</p>
          <span
            className="font-display leading-none uppercase"
            style={{ fontSize: 20, color: nextMeta.color }}
          >
            {nextGrade}
          </span>
          <span
            className="text-[10px] font-cond font-bold leading-none"
            style={{ color: nextMeta.color }}
          >
            ({nextMeta.topPct})
          </span>
        </div>

        <p className="text-sm text-ink-1 leading-relaxed">
          회원님은 현재{" "}
          <span className="text-ink-0 font-bold">[{grade}]</span> 등급입니다. {nextGrade} 수준의 사람들은 보통
          골격근량이{" "}
          <span style={{ color: "#D3FF52" }} className="font-bold">+{smmDelta}kg</span> 많고,
          체지방률은{" "}
          <span style={{ color: "#ff8c00" }} className="font-bold">-{bfDelta}%</span> 낮습니다.
        </p>

        {/* 중첩 막대그래프 */}
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis dataKey="label" tick={{ fill: "#888", fontSize: 10, fontFamily: "Barlow Condensed" }} axisLine={false} />
            <YAxis tick={{ fill: "#555", fontSize: 10, fontFamily: "Barlow Condensed" }} axisLine={false} />
            <Tooltip contentStyle={{ backgroundColor: "rgba(8,8,8,0.95)", border: "1px solid #333", borderRadius: 8, fontFamily: "Barlow Condensed", fontSize: 11 }} />
            <Bar dataKey="목표" fill={`${nextMeta.color}40`} radius={[4, 4, 0, 0]} />
            <Bar dataKey="현재" fill={nextMeta.color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* 정밀 수치 제언 */}
        <div className="grid grid-cols-2 gap-2">
          {smmDelta > 0 && (
            <div
              className="rounded-xl p-3 flex flex-col gap-1.5"
              style={{ background: "rgba(211,255,82,0.08)", border: "1px solid rgba(211,255,82,0.2)" }}
            >
              <p className="text-[9px] font-cond text-volt uppercase tracking-wider leading-none">근육 목표</p>
              <p className="font-display leading-none" style={{ color: "#D3FF52", fontSize: 18 }}>
                +{smmDelta}kg
              </p>
              <p className="text-[9px] font-cond text-ink-3 leading-relaxed">점진적 과부하 주 3회</p>
            </div>
          )}
          {bfDelta > 0 && (
            <div
              className="rounded-xl p-3 flex flex-col gap-1.5"
              style={{ background: "rgba(255,140,0,0.08)", border: "1px solid rgba(255,140,0,0.2)" }}
            >
              <p className="text-[9px] font-cond text-warn uppercase tracking-wider leading-none">체지방 목표</p>
              <p className="font-display leading-none" style={{ color: "#ff8c00", fontSize: 18 }}>
                -{bfDelta}%
              </p>
              <p className="text-[9px] font-cond text-ink-3 leading-relaxed">칼로리 -{calDeficit}kcal/일</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* 목표 달성 게이지 */
function GoalGauge({
  label, current, target, unit, color, higher,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  color: string;
  higher: boolean;
}) {
  // higher=true: 높을수록 좋음 (근육량), higher=false: 낮을수록 좋음 (체지방률)
  const progress = higher
    ? Math.min(100, Math.max(0, (current / target) * 100))
    : Math.min(100, Math.max(0, ((target + (target - current)) / (target * 2)) * 100));
  const isAchieved = higher ? current >= target : current <= target;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-cond text-ink-2 uppercase tracking-wider leading-none">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="font-display tabular-nums leading-none" style={{ fontSize: 16, color }}>
            {current}{unit}
          </span>
          <span className="text-[10px] font-cond text-ink-3 leading-none">→ 목표 {target}{unit}</span>
          {isAchieved && (
            <span className="text-[9px] font-cond font-bold text-volt leading-none">✓ 달성!</span>
          )}
        </div>
      </div>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: 10, background: "var(--pt-2)", border: "1px solid var(--pt-5)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, progress)}%`,
            background: isAchieved
              ? "var(--grad-volt-bar)"
              : `linear-gradient(90deg, ${color}80 0%, ${color} 100%)`,
            boxShadow: isAchieved ? "0 0 10px var(--volt-glow-2)" : `0 0 8px ${color}60`,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <p className="text-[9px] font-cond text-ink-4 text-right leading-none">
        {Math.round(progress)}% 완료
      </p>
    </div>
  );
}

/* ACSM 액션 가이드 */
function ACSMActionGuide({
  gender, needMuscleKg, needFatPct, currentWeight,
}: {
  grade: ACSMGrade;
  gender: "male" | "female";
  needMuscleKg: number;
  needFatPct: number;
  currentWeight: number;
}) {
  const proteinTarget = Math.round(currentWeight * (gender === "male" ? 1.8 : 1.6));
  const calDeficit = needFatPct > 0 ? Math.round(needFatPct * 500) : 0;

  const guides = [
    {
      icon: <Zap size={14} />,
      color: "#D3FF52",
      title: "운동 강도 처방",
      text: needMuscleKg > 0
        ? `골격근량 ${needMuscleKg}kg 증가를 위해선 점진적 과부하가 필수입니다. 현재 중량에서 매주 1.25~2.5kg씩 증량하거나, 마지막 세트를 실패 지점(더 이상 들 수 없는 순간)까지 밀어붙이는 강도로 주 3회 이상 훈련이 필요합니다.`
        : "현재 근육량은 양호합니다. 현재 볼륨을 유지하면서 운동 퀄리티를 높이는 데 집중하세요.",
    },
    {
      icon: <Flame size={14} />,
      color: "#ff8c00",
      title: "식단 & 칼로리 처방",
      text: needFatPct > 0
        ? `체지방 ${needFatPct}% 감소를 위해 일일 섭취 칼로리를 약 ${calDeficit}kcal 줄여야 합니다. 이는 매일 밥 한 공기를 줄이거나, 심박수 65% 강도(노래 부르기 힘든 정도)의 유산소 운동으로 300~400kcal를 추가로 소모하는 노력이 필요합니다.`
        : "체지방률이 양호합니다. 현재 식단을 유지하면서 단백질 섭취에 집중하세요.",
    },
    {
      icon: <Activity size={14} />,
      color: "#5BA8FF",
      title: "단백질 섭취 가이드",
      text: `신지용 트레이너 권장: 하루 단백질 목표는 ${proteinTarget}g (체중 × ${gender === "male" ? 1.8 : 1.6}g)입니다. 닭가슴살 외에 계란(개당 6g), 연어(100g당 20g), 두부(100g당 8g)를 다양하게 드세요. 한 끼에 몰아 먹기보다 3~4끼에 분산 섭취가 근합성 최적화의 핵심입니다.`,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {guides.map((g, i) => (
        <div key={i} className="pt-card flex items-start gap-4" style={{ padding: 20 }}>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${g.color}1A`, border: `1px solid ${g.color}40` }}
          >
            <span style={{ color: g.color }}>{g.icon}</span>
          </div>
          <div className="flex flex-col gap-2 min-w-0">
            <p className="text-xs font-cond font-bold text-ink-0 leading-none">{g.title}</p>
            <p className="text-xs text-ink-1 leading-relaxed">{g.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
