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
    체지방: h.body_fat_pct ?? 0,
    체중: h.weight_kg ?? 0,
  }));

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

            {/* 체지방률 게이지 */}
            {latest.body_fat_pct != null && (
              <BFGauge
                value={latest.body_fat_pct}
                gender={g}
                ageGroup={ageGroup}
                color={gradeMeta.color}
              />
            )}
          </div>
        </section>
      )}

      {/* ─── 2. 6종 지표 카드 ─── */}
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
            historyKey="체지방"
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
            historyKey="체지방"
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
          />
          <MetricCard
            icon={<Zap size={13} />}
            label="기초대사량 BMR"
            value={latest.bmr_kcal}
            unit="kcal"
            prevValue={first?.bmr_kcal}
            color="#5BA8FF"
            expandable={false}
          />
        </div>
      </section>

      {/* ─── 3. 체형 맵 (산점도 형태) ─── */}
      {latest.body_fat_pct != null && latest.skeletal_muscle_kg != null && (
        <section className="flex flex-col gap-4">
          <SectionTitle en="BODY COMPOSITION MAP" ko="체형 위치 맵" />
          <BodyShapeMap
            bodyFatPct={latest.body_fat_pct}
            smmKg={latest.skeletal_muscle_kg}
            gender={g}
            ageGroup={ageGroup}
          />
        </section>
      )}

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

      {/* ─── 7. 히스토리 차트 ─── */}
      {history.length >= 2 && (
        <section className="flex flex-col gap-4">
          <SectionTitle en="MEASUREMENT HISTORY" ko="3개월 인바디 변화 추이" />
          <div className="pt-card flex flex-col gap-5" style={{ padding: 22 }}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis dataKey="date" tick={{ fill: "#555", fontSize: 10, fontFamily: "Barlow Condensed" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#555", fontSize: 10, fontFamily: "Barlow Condensed" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "rgba(8,8,8,0.95)", border: "1px solid #333", borderRadius: 10, fontFamily: "Barlow Condensed", fontSize: 12 }} />
                <Line type="monotone" dataKey="근육" stroke="#D3FF52" strokeWidth={2.5} dot={{ fill: "#D3FF52", r: 4 }} />
                <Line type="monotone" dataKey="체지방" stroke="#ff8c00" strokeWidth={2} strokeDasharray="4 4" dot={{ fill: "#ff8c00", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-5 justify-center pt-2 border-t border-pt-5">
              {[["골격근량", "#D3FF52"], ["체지방률", "#ff8c00"]].map(([label, color]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: color }} />
                  <span className="text-[11px] font-cond text-ink-2 leading-none">{label}</span>
                </div>
              ))}
            </div>
          </div>
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

/* 개별 지표 카드 */
function MetricCard({
  icon, label, value, unit, prevValue, color, inverse = false,
  expandable = false, isExpanded = false, onToggle,
  historyData, historyKey,
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
  historyData?: { date: string; [key: string]: any }[];
  historyKey?: string;
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

/* 체형 맵 */
function BodyShapeMap({
  bodyFatPct, smmKg, gender, ageGroup,
}: {
  bodyFatPct: number;
  smmKg: number;
  gender: "male" | "female";
  ageGroup: "20s" | "30s" | "40s" | "50s";
}) {
  const ref = ACSM_BF[gender][ageGroup];
  const tgt = TARGET_SMM[gender];

  // 맵 범위 정의
  const xMin = gender === "male" ? 8  : 14;
  const xMax = gender === "male" ? 36 : 42;
  const yMin = gender === "male" ? 28 : 18;
  const yMax = gender === "male" ? 44 : 30;

  const xPct = ((bodyFatPct - xMin) / (xMax - xMin)) * 100;
  const yPct = 100 - ((smmKg - yMin) / (yMax - yMin)) * 100;

  const zones = [
    { label: "Elite", x: ((ref.elite - xMin) / (xMax - xMin)) * 100, color: "#D3FF52" },
    { label: "Good",  x: ((ref.good  - xMin) / (xMax - xMin)) * 100, color: "#5BA8FF" },
    { label: "Fair",  x: ((ref.fair  - xMin) / (xMax - xMin)) * 100, color: "#ff8c00" },
  ];

  return (
    <div className="pt-card flex flex-col gap-4" style={{ padding: 20 }}>
      <p className="text-[10px] font-cond text-ink-2 leading-relaxed">
        X축: 체지방률(%) · Y축: 골격근량(kg) · 점: 현재 위치
      </p>
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{ height: 200, background: "var(--pt-1)", border: "1px solid var(--pt-5)" }}
      >
        {/* 구간 세로선 */}
        {zones.map((z) => (
          <div
            key={z.label}
            className="absolute top-0 bottom-0"
            style={{
              left: `${z.x}%`,
              width: 1,
              background: `${z.color}40`,
            }}
          >
            <span
              className="absolute top-2 text-[8px] font-cond leading-none"
              style={{ color: z.color, transform: "translateX(-50%)" }}
            >
              {z.label}
            </span>
          </div>
        ))}

        {/* 목표 가로선 */}
        <div
          className="absolute left-0 right-0"
          style={{
            top: `${100 - ((tgt.good - yMin) / (yMax - yMin)) * 100}%`,
            height: 1,
            background: "rgba(211,255,82,0.3)",
          }}
        />

        {/* 현재 위치 점 */}
        <div
          className="absolute anim-pulse"
          style={{
            left: `${Math.max(2, Math.min(96, xPct))}%`,
            top: `${Math.max(4, Math.min(94, yPct))}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            className="rounded-full"
            style={{
              width: 16, height: 16,
              background: "#D3FF52",
              border: "3px solid #000",
              boxShadow: "0 0 14px rgba(211,255,82,0.8)",
            }}
          />
        </div>

        {/* 축 라벨 */}
        <div className="absolute bottom-2 left-0 right-0 flex justify-between px-3">
          <span className="text-[8px] font-cond text-ink-4">낮은 체지방</span>
          <span className="text-[8px] font-cond text-ink-4">높은 체지방</span>
        </div>
      </div>

      <p className="text-xs font-cond text-ink-2 leading-relaxed">
        현재 체지방률{" "}
        <span className="text-volt font-bold">{bodyFatPct}%</span> ·
        골격근량{" "}
        <span className="text-volt font-bold">{smmKg}kg</span>
      </p>
    </div>
  );
}

/* 격차 분석 (중첩 막대) */
function GapAnalysis({
  grade, gender, ageGroup, currentSMM, currentBFPct, currentWeight,
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
  const proteinTarget = Math.round(currentWeight * (gender === "male" ? 1.8 : 1.6));

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
  grade, gender, needMuscleKg, needFatPct, currentWeight,
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
