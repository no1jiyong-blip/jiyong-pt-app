"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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
import { InBodyPhotoCapture } from "@/components/shared/InBodyPhotoCapture";
import type { InBodyValues } from "@/lib/inbody";

const VOLT = "#D3FF52";

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

/* 목표 골격근량 기준 — 절대 kg (수준 칩의 퍼센타일 계산 + 기준표 공용) */
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

/* 기준표용 3단 구간(표준 이하/표준/우수) 판정 — lower=값이 낮을수록 좋은 지표, higher=값이 높을수록 좋은 지표 */
function bandLowerBetter(value: number, elite: number, good: number): 0 | 1 | 2 {
  if (value <= elite) return 2;
  if (value <= good) return 1;
  return 0;
}
function bandHigherBetter(value: number, elite: number, good: number): 0 | 1 | 2 {
  if (value >= elite) return 2;
  if (value >= good) return 1;
  return 0;
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

/* BODY TREND 차트의 지표별 한글 라벨·단위·소수점 자릿수 (툴팁/Y축 표기 공용) */
const TREND_META: Record<"skeletal_muscle_kg" | "body_fat_pct" | "weight_kg", { label: string; unit: string; decimals: number }> = {
  skeletal_muscle_kg: { label: "골격근량", unit: "kg", decimals: 1 },
  body_fat_pct: { label: "체지방률", unit: "%", decimals: 1 },
  weight_kg: { label: "체중", unit: "kg", decimals: 1 },
};

const GRADE_TOP_PCT: Record<ACSMGrade, string> = {
  Elite: "상위 20%",
  Good: "상위 20~40%",
  Fair: "상위 40~60%",
  Poor: "상위 60% 이상",
};

/* 최근 변화(직전 측정 대비) 방향을 한 줄 문장으로 요약 */
function buildTrendPhrase(muscleDelta: number | null, fatDelta: number | null): string {
  const muscleUp = muscleDelta != null && muscleDelta > 0;
  const muscleDown = muscleDelta != null && muscleDelta < 0;
  const fatUp = fatDelta != null && fatDelta > 0;
  const fatDown = fatDelta != null && fatDelta < 0;

  if (muscleUp && fatDown) return "근육량이 늘고 체지방이 줄고 있어요";
  if (fatUp && muscleDown) return "체지방이 늘고 근육량이 줄고 있어요";
  if (muscleUp) return "근육량이 늘고 있어요";
  if (fatDown) return "체지방이 줄고 있어요";
  if (fatUp) return "체지방이 늘고 있어요";
  if (muscleDown) return "근육량이 줄고 있어요";
  return "변화가 크지 않아요";
}

interface Props {
  memberId?: string;
  gender?: "male" | "female" | null;
  age?: string | null; // birth_date
}

export function BodyMetrics({ memberId, gender, age }: Props) {
  const [history, setHistory] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
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
  const genderLabel = g === "male" ? "남성" : "여성";
  const ageGroupLabel = `${ageGroup.replace("s", "")}대`;

  const loadHistory = useCallback(async () => {
    if (!memberId) { setLoading(false); return; }
    const { data } = await supabase
      .from("body_measurements")
      .select("*")
      .eq("member_id", memberId)
      .order("measured_at", { ascending: true });
    setHistory((data ?? []) as BodyMeasurement[]);
    setLoading(false);
  }, [memberId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  /** 회원 본인 저장 — /api/body-measurements가 토큰으로 본인 확인 후 member_id를 서버에서 직접 조회해 저장 */
  const saveFromPhoto = async (values: InBodyValues) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return { error: "로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요." };

    const res = await fetch("/api/body-measurements", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "저장에 실패했습니다" };
    return {};
  };

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

  const conclusionText = useMemo(() => {
    if (!grade) return `${genderLabel} ${ageGroupLabel} 기준 체지방률 기록이 없어 등급을 계산할 수 없어요.`;
    const base = `${genderLabel} ${ageGroupLabel} 기준 ${GRADE_TOP_PCT[grade]}`;
    if (!prevRecord) return `${base} 수준이에요.`;
    return `${base}, ${buildTrendPhrase(muscleDeltaRecent, fatPctDeltaRecent)}.`;
  }, [grade, genderLabel, ageGroupLabel, prevRecord, muscleDeltaRecent, fatPctDeltaRecent]);

  /* 차트 데이터 */
  const chartData = history.map((h) => ({
    date: h.measured_at.slice(5),
    근육: h.skeletal_muscle_kg ?? 0,
    체지방률: h.body_fat_pct ?? 0,
    체지방량: h.body_fat_kg ?? 0,
    체중: h.weight_kg ?? 0,
    whr: h.whr ?? 0,
    bmr: h.bmr_kcal ?? 0,
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

  const levelChips = [
    { key: "smm", label: "골격근 수준", percentile: smmPercentile },
    { key: "bf", label: "체지방 수준", percentile: bfPercentile },
    { key: "whr", label: "복부지방 수준", percentile: whrPercentile },
  ].filter((c): c is { key: string; label: string; percentile: number } => c.percentile != null);

  const bestChipKey = levelChips.length > 0
    ? levelChips.reduce((best, c) => (c.percentile > best.percentile ? c : best)).key
    : null;

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

  /* 최초 측정 대비 누적 변화 — BODY TREND 지표 탭의 보조 수치 */
  const muscleDeltaTotal = latest?.skeletal_muscle_kg != null && first?.skeletal_muscle_kg != null
    ? Math.round((latest.skeletal_muscle_kg - first.skeletal_muscle_kg) * 10) / 10
    : null;

  if (loading) {
    return (
      <div className="py-12 text-center">
        <p className="text-ink-3 font-cond anim-pulse text-sm">데이터 불러오는 중...</p>
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="flex flex-col gap-4">
        <div className="pt-card text-center" style={{ padding: 28 }}>
          <p className="text-ink-3 font-cond text-sm leading-relaxed">
            아직 인바디 측정 기록이 없습니다.
            <br />인바디 결과지 사진을 올리거나 트레이너에게 입력을 요청하세요.
          </p>
        </div>
        <InBodyPhotoCapture onSave={saveFromPhoto} onSaved={loadHistory} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">

      {/* ─── 0. 사진으로 기록하기 ─── */}
      <InBodyPhotoCapture onSave={saveFromPhoto} onSaved={loadHistory} />

      {/* ─── 1. 체성분 종합 결론 (결론 우선 — 가장 먼저 노출) ─── */}
      <section className="flex flex-col gap-4">
        <SectionTitle title="체성분 종합 결론" />

        <div className="pt-card flex flex-col gap-5" style={{ padding: 22 }}>
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

          <p className="font-bold text-ink-0 leading-snug" style={{ fontSize: 18 }}>
            {conclusionText}
          </p>

          {levelChips.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {levelChips.map((c) => (
                <PercentileChip
                  key={c.key}
                  label={c.label}
                  topPct={Math.max(1, Math.round(100 - c.percentile))}
                  highlight={c.key === bestChipKey}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── 2. 체성분 변화 추이 ─── */}
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
                delta={muscleDeltaTotal}
                goodDirection="up"
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
                goodDirection="down"
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
                goodDirection="neutral"
              />
            </div>

            {/* 추이 차트 — 선택 지표와 무관하게 항상 단일 볼트 컬러 라인 */}
            <ResponsiveContainer width="100%" height={176}>
              <AreaChart data={trendHistory} margin={{ top: 16, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  {/* 라인 직하단에만 아주 미세하게 번지는 페이드 — 넓은 면 채우기 대신 포인트 강조용 */}
                  <linearGradient id="bodyTrendGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={VOLT} stopOpacity={0.12} />
                    <stop offset="22%" stopColor={VOLT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey={(d: BodyMeasurement) => d.measured_at.slice(5)}
                  tick={{ fill: "#555", fontSize: 10, fontFamily: "Pretendard, sans-serif" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  domain={["dataMin - 1", "dataMax + 1"]}
                  tick={{ fill: "#555", fontSize: 10, fontFamily: "Pretendard, sans-serif" }}
                  tickFormatter={(v: number) => v.toFixed(TREND_META[trendMetric].decimals)}
                  tickCount={4}
                  width={34}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ stroke: "rgba(255,255,255,0.14)", strokeWidth: 1 }}
                  content={
                    <BodyTrendTooltip
                      metricLabel={TREND_META[trendMetric].label}
                      unit={TREND_META[trendMetric].unit}
                      decimals={TREND_META[trendMetric].decimals}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey={trendMetric}
                  stroke={VOLT}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#bodyTrendGlow)"
                  dot={{ r: 3, fill: VOLT, stroke: "#080808", strokeWidth: 1.5 }}
                  activeDot={{ r: 5, fill: VOLT, stroke: "#080808", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ─── 3. 체성분 주요 지표 — 단일 통카드 리스트 + 아코디언 ─── */}
      <section className="flex flex-col gap-4">
        <SectionTitle title="체성분 주요 지표" />

        <div className="pt-card" style={{ padding: 0 }}>
          {[
            { key: "weight", label: "체중", value: latest.weight_kg, prevValue: prevRecord?.weight_kg, unit: "kg", goodDirection: "neutral" as const, historyKey: "체중" },
            { key: "smm", label: "골격근량", value: latest.skeletal_muscle_kg, prevValue: prevRecord?.skeletal_muscle_kg, unit: "kg", goodDirection: "up" as const, historyKey: "근육" },
            { key: "bfKg", label: "체지방량", value: latest.body_fat_kg, prevValue: prevRecord?.body_fat_kg, unit: "kg", goodDirection: "down" as const, historyKey: "체지방량" },
            { key: "bfPct", label: "체지방률", value: latest.body_fat_pct, prevValue: prevRecord?.body_fat_pct, unit: "%", goodDirection: "down" as const, historyKey: "체지방률" },
            { key: "whr", label: "복부지방률(WHR)", value: latest.whr, prevValue: prevRecord?.whr, unit: "", goodDirection: "down" as const, historyKey: "whr" },
            { key: "bmr", label: "기초대사량(BMR)", value: latest.bmr_kcal, prevValue: prevRecord?.bmr_kcal, unit: "kcal", goodDirection: "neutral" as const, historyKey: "bmr" },
          ].map((row, idx) => (
            <div key={row.key} style={idx > 0 ? { borderTop: "1px solid rgba(255,255,255,0.06)" } : undefined}>
              <MetricRow
                label={row.label}
                value={row.value}
                unit={row.unit}
                prevValue={row.prevValue}
                goodDirection={row.goodDirection}
                expanded={expandedRow === row.key}
                onToggle={() => setExpandedRow(expandedRow === row.key ? null : row.key)}
                historyData={chartData}
                historyKey={row.historyKey}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ─── 4. 성별·연령 맞춤 기준표 ─── */}
      <section className="flex flex-col gap-4">
        <SectionTitle title="내 수준 확인하기" />
        <StandardsTable
          gender={g}
          ageGroup={ageGroup}
          genderLabel={genderLabel}
          ageGroupLabel={ageGroupLabel}
          bfPct={latest.body_fat_pct}
          smmKg={latest.skeletal_muscle_kg}
          whr={latest.whr}
        />
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

/* 동년배 대비 퍼센타일 요약 칩 — 무채색 기반, 가장 좋은 지표 1개만 볼트 포인트 */
function PercentileChip({
  label, topPct, highlight,
}: {
  label: string;
  topPct: number;
  highlight: boolean;
}) {
  return (
    <div
      className="rounded-xl p-2.5 text-center"
      style={{
        background: highlight ? "rgba(211,255,82,0.08)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${highlight ? "var(--volt-glow-2)" : "var(--pt-5)"}`,
      }}
    >
      <span className="text-[10px] font-cond font-semibold text-ink-3 block leading-none mb-1">{label}</span>
      <span
        className="font-cond font-bold text-sm leading-none"
        style={{ color: highlight ? "var(--volt)" : "var(--ink-0)" }}
      >
        상위 <span className="font-mono-num font-bold tabular-nums">{topPct}</span>%
      </span>
    </div>
  );
}

/* BODY TREND 지표 전환 탭 — 무채색 + 볼트 포인트(개선 방향일 때만) */
function TrendTab({
  active, onClick, label, value, unit, delta, goodDirection,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  value: number | null | undefined;
  unit: string;
  delta: number | null;
  goodDirection: "up" | "down" | "neutral";
}) {
  const isGood = delta != null && delta !== 0 && goodDirection !== "neutral"
    ? (goodDirection === "up" ? delta > 0 : delta < 0)
    : false;
  const deltaColor = delta == null || delta === 0 ? "var(--ink-4)" : isGood ? "var(--volt)" : "var(--ink-3)";

  return (
    <button
      type="button"
      onClick={onClick}
      className="tap-haptic p-2.5 rounded-2xl text-left transition-all"
      style={
        active
          ? { background: "rgba(211,255,82,0.07)" }
          : { background: "rgba(255,255,255,0.02)" }
      }
    >
      <div className="flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: active ? "var(--volt)" : "var(--ink-4)" }}
        />
        <span
          className="text-[10px] font-cond font-bold leading-none"
          style={{ color: active ? "var(--ink-0)" : "var(--ink-3)" }}
        >
          {label}
        </span>
      </div>
      <div className="flex items-baseline justify-between mt-1 gap-1">
        <span className="font-mono-num font-extrabold text-ink-0 text-sm leading-none tabular-nums">
          {value != null ? value : "—"}{unit}
        </span>
        {delta != null && (
          <span className="font-mono-num font-bold text-[10px] leading-none shrink-0 tabular-nums" style={{ color: deltaColor }}>
            {delta > 0 ? "+" : ""}{delta}{unit}
          </span>
        )}
      </div>
    </button>
  );
}

/* BODY TREND 커스텀 툴팁 — DB 컬럼명 노출 없이 한글 지표명 + 단위로 표기 */
function BodyTrendTooltip({
  active, payload, label, metricLabel, unit, decimals,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  metricLabel: string;
  unit: string;
  decimals: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const raw = payload[0].value;
  const value = typeof raw === "number" ? raw.toFixed(decimals) : raw;

  return (
    <div
      style={{
        background: "rgba(8,8,8,0.95)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 10,
        padding: "8px 12px",
      }}
    >
      <p className="font-cond text-[10px] text-ink-3 tabular-nums leading-none" style={{ marginBottom: 4 }}>
        {label}
      </p>
      <p className="font-cond text-ink-0 leading-none" style={{ fontSize: 13 }}>
        {metricLabel}{" "}
        <span className="font-mono-num font-bold tabular-nums" style={{ color: "var(--volt)" }}>
          {value}{unit}
        </span>
      </p>
    </div>
  );
}

/* 체성분 주요 지표 — 통카드 1줄 행 + 아코디언 (게이지/아이콘 없이 수치 중심) */
function MetricRow({
  label, value, unit, prevValue, goodDirection, expanded, onToggle, historyData, historyKey,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
  prevValue: number | null | undefined;
  goodDirection: "up" | "down" | "neutral";
  expanded: boolean;
  onToggle: () => void;
  historyData?: { date: string; [key: string]: string | number }[];
  historyKey?: string;
}) {
  const delta =
    value != null && prevValue != null ? Math.round((value - prevValue) * 100) / 100 : null;
  const isGood = delta != null && delta !== 0 && goodDirection !== "neutral"
    ? (goodDirection === "up" ? delta > 0 : delta < 0)
    : false;
  const deltaColor = delta == null || delta === 0 ? "var(--ink-4)" : isGood ? "var(--volt)" : "var(--ink-3)";
  const canExpand = !!(historyData && historyKey && historyData.length >= 2);

  return (
    <div>
      <button
        type="button"
        onClick={canExpand ? onToggle : undefined}
        className="tap-haptic w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="text-sm font-cond font-semibold text-ink-1">{label}</span>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="font-mono-num font-bold text-ink-0 tabular-nums" style={{ fontSize: 15 }}>
            {value != null ? value : "—"}{value != null ? unit : ""}
          </span>
          {delta != null && delta !== 0 && (
            <span className="font-mono-num text-xs tabular-nums shrink-0" style={{ color: deltaColor }}>
              {delta > 0 ? "▲" : "▼"}{Math.abs(delta)}{unit}
            </span>
          )}
          {canExpand && (
            expanded ? <ChevronUp size={14} className="text-ink-4 shrink-0" /> : <ChevronDown size={14} className="text-ink-4 shrink-0" />
          )}
        </div>
      </button>
      {expanded && canExpand && (
        <div className="px-5 pb-4">
          <ResponsiveContainer width="100%" height={70}>
            <LineChart data={historyData} margin={{ top: 4, right: 2, left: -30, bottom: 0 }}>
              <Line type="monotone" dataKey={historyKey!} stroke={VOLT} strokeWidth={2} dot={{ r: 3, fill: VOLT }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* 성별·연령 맞춤 기준표 — 표준 이하/표준/우수(상위) 3단, 현재 위치만 볼트 하이라이트 */
function StandardsTable({
  gender, ageGroup, genderLabel, ageGroupLabel, bfPct, smmKg, whr,
}: {
  gender: "male" | "female";
  ageGroup: "20s" | "30s" | "40s" | "50s";
  genderLabel: string;
  ageGroupLabel: string;
  bfPct: number | null;
  smmKg: number | null;
  whr: number | null;
}) {
  const bf = ACSM_BF[gender][ageGroup];
  const smm = TARGET_SMM[gender];
  const whrRef = WHR_BANDS[gender];

  const rows: { key: string; label: string; cells: [string, string, string]; currentBand: 0 | 1 | 2 | null }[] = [
    {
      key: "bf",
      label: "체지방률",
      cells: [`${bf.good}% 초과`, `${bf.elite}~${bf.good}%`, `${bf.elite}% 이하`],
      currentBand: bfPct != null ? bandLowerBetter(bfPct, bf.elite, bf.good) : null,
    },
    {
      key: "smm",
      label: "골격근량",
      cells: [`${smm.good}kg 미만`, `${smm.good}~${smm.elite}kg`, `${smm.elite}kg 이상`],
      currentBand: smmKg != null ? bandHigherBetter(smmKg, smm.elite, smm.good) : null,
    },
    {
      key: "whr",
      label: "복부지방률(WHR)",
      cells: [`${whrRef.good} 초과`, `${whrRef.elite}~${whrRef.good}`, `${whrRef.elite} 이하`],
      currentBand: whr != null ? bandLowerBetter(whr, whrRef.elite, whrRef.good) : null,
    },
  ];

  return (
    <div className="pt-card" style={{ padding: 0 }}>
      <div className="px-5 pt-5 pb-3">
        <span className="text-xs font-cond text-ink-3">
          {genderLabel} 기준 (체지방률은 {ageGroupLabel} 기준 적용)
        </span>
      </div>

      <table className="w-full text-center border-collapse" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "30%" }} />
          <col style={{ width: "23.33%" }} />
          <col style={{ width: "23.33%" }} />
          <col style={{ width: "23.33%" }} />
        </colgroup>
        <thead>
          <tr className="text-[10px] font-cond font-bold text-ink-4">
            <th className="text-left px-5 py-2 font-bold">항목</th>
            <th className="py-2 font-bold">표준 이하</th>
            <th className="py-2 font-bold">표준</th>
            <th className="py-2 font-bold">우수(상위)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <td className="text-left px-5 py-3 text-xs font-cond font-semibold text-ink-1">{row.label}</td>
              {row.cells.map((cell, i) => {
                const active = row.currentBand === i;
                return (
                  <td key={i} className="py-3 px-1">
                    <span
                      className="inline-block font-mono-num leading-tight tabular-nums px-1.5 py-1 rounded-lg"
                      style={{
                        fontSize: 10,
                        fontWeight: active ? 700 : 500,
                        color: active ? "var(--volt)" : "var(--ink-3)",
                        background: active ? "rgba(211,255,82,0.10)" : "transparent",
                        border: active ? "1px solid var(--volt-glow-2)" : "1px solid transparent",
                      }}
                    >
                      {cell}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ height: 16 }} />
    </div>
  );
}
