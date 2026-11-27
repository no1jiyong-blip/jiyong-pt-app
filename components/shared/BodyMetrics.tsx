"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Target, Zap, Flame, Activity } from "lucide-react";
import {
  XAxis,
  YAxis,
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
  const prevRecord = history.length >= 2 ? history[history.length - 2] : null;

  /* 최근 측정 기준 변화 (직전 1회 대비) — 상단 결론 요약용 */
  const muscleDeltaRecent = latest?.skeletal_muscle_kg != null && prevRecord?.skeletal_muscle_kg != null
    ? Math.round((latest.skeletal_muscle_kg - prevRecord.skeletal_muscle_kg) * 10) / 10
    : null;
  const fatPctDeltaRecent = latest?.body_fat_pct != null && prevRecord?.body_fat_pct != null
    ? Math.round((latest.body_fat_pct - prevRecord.body_fat_pct) * 10) / 10
    : null;
  const weightDeltaRecent = latest?.weight_kg != null && prevRecord?.weight_kg != null
    ? Math.round((latest.weight_kg - prevRecord.weight_kg) * 10) / 10
    : null;

  const grade = latest?.body_fat_pct != null
    ? getGrade(latest.body_fat_pct, g, ageGroup)
    : null;
  const gradeMeta = grade ? GRADE_META[grade] : null;

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

      {/* ─── 0. 핵심 변화 요약 (결론 우선 — 가장 먼저 노출) ─── */}
      <section className="flex flex-col gap-4">
        <SectionTitle title="최근 측정 기준 변화" />

        <div className="pt-card flex flex-col gap-4" style={{ padding: 20 }}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-cond text-ink-3 tabular-nums">
              {latest.measured_at.slice(5)} 측정
            </span>
            {prevRecord && (
              <span className="text-xs font-cond text-ink-4 tabular-nums">
                직전 {prevRecord.measured_at.slice(5)} 대비
              </span>
            )}
          </div>

          {prevRecord ? (
            <div className="grid grid-cols-3 gap-2">
              <DeltaStat label="골격근량" delta={muscleDeltaRecent} unit="kg" tone="up-good" />
              <DeltaStat label="체지방률" delta={fatPctDeltaRecent} unit="%" tone="down-good" />
              <DeltaStat label="체중" delta={weightDeltaRecent} unit="kg" tone="neutral" />
            </div>
          ) : (
            <p className="text-sm text-ink-3 font-cond leading-relaxed">
              측정 기록이 1건뿐이에요. 다음 측정부터 직전 대비 변화를 확인할 수 있습니다.
            </p>
          )}
        </div>
      </section>

      {/* ─── 1. ACSM 등급 카드 (간결화 — 등급 + 동년배 수준만) ─── */}
      {grade && gradeMeta && (
        <section className="flex flex-col gap-4">
          <SectionTitle title="체성분 등급" />

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
          </div>
        </section>
      )}

      {/* ─── 2. BODY TREND — 기간별 체성분 변화 추이 ─── */}
      {history.length >= 2 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle title="체성분 변화 추이" />
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
        <SectionTitle title="체성분 주요 지표" />

        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            icon={<Activity size={13} />}
            label="체중"
            value={latest.weight_kg}
            unit="kg"
            prevValue={prevRecord?.weight_kg}
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
            prevValue={prevRecord?.skeletal_muscle_kg}
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
            prevValue={prevRecord?.body_fat_kg}
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
            prevValue={prevRecord?.body_fat_pct}
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
            prevValue={prevRecord?.whr}
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
            prevValue={prevRecord?.bmr_kcal}
            color="#5BA8FF"
            expandable={false}
            rangePercent={bmrRangePct}
            rangeCaptions={["최저", "최근 변화폭", "최고"]}
          />
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════
   서브 컴포넌트
   ═══════════════════════════════════════ */

function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="font-cond font-bold text-ink-0" style={{ fontSize: 17 }}>
      {title}
    </h3>
  );
}

/* 핵심 변화 요약 카드의 3단 스탯 (직전 측정 대비) */
function DeltaStat({
  label, delta, unit, tone,
}: {
  label: string;
  delta: number | null;
  unit: string;
  tone: "up-good" | "down-good" | "neutral";
}) {
  const color =
    delta == null || delta === 0 ? "var(--ink-2)"
    : tone === "neutral" ? "var(--ink-0)"
    : tone === "up-good" ? (delta > 0 ? "var(--volt)" : "var(--danger)")
    : (delta < 0 ? "var(--volt)" : "var(--danger)");

  return (
    <div
      className="flex flex-col gap-1.5 items-center text-center rounded-xl p-3"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--pt-5)" }}
    >
      <span className="text-[10px] font-cond font-semibold text-ink-3 leading-none">{label}</span>
      <span className="font-mono-num font-extrabold text-base leading-none" style={{ color }}>
        {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta}${unit}`}
      </span>
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
          {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}{unit} <span className="text-ink-4">· 직전 대비</span>
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


