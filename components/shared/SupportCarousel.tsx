"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { Session, ExerciseRecord } from "@/lib/types";
import { calcOneRM } from "@/lib/types";
import { cn } from "@/lib/utils";

const VOLT = "#D3FF52";

/* ─── 상체 / 하체 보조 종목 목록 ─── */
const UPPER_EXERCISES = [
  "랫풀다운",
  "케이블 로우",
  "숄더프레스",
  "체스트프레스",
  "풀업머신",
];
const LOWER_EXERCISES = [
  "레그익스텐션",
  "레그컬",
  "레그프레스",
  "힙어브덕션",
  "힙어덕션",
  "글루트머신",
];

// 풀업머신은 보조 무게가 낮을수록 강함 → 역산 로직 적용
const PULLUP_NAMES = ["풀업머신", "풀업"];

/* 세션별 수행 내역 기본 노출 건수 — 나머지는 "전체 기록 보기"로 펼침 */
const LOG_PREVIEW_COUNT = 5;

/* 종목별 쉬운 한글 설명 — 운동 명칭만으로 기능이 떠오르지 않을 때 보조 설명 */
const EXERCISE_DESC: Record<string, string> = {
  랫풀다운: "등 넓은근을 당겨 등 두께를 키우는 운동이에요.",
  "케이블 로우": "팔과 등을 당겨 등 중앙부를 두껍게 만드는 운동이에요.",
  숄더프레스: "어깨(삼각근)를 위로 밀어 올려 어깨를 키우는 운동이에요.",
  체스트프레스: "가슴을 앞으로 밀어 상체 앞면을 키우는 운동이에요.",
  풀업머신: "보조 무게로 몸을 당겨 올려 등·팔 힘을 기르는 운동이에요. 보조 무게가 낮을수록 더 강한 거예요.",
  레그익스텐션: "허벅지 앞쪽(대퇴사두근)을 펴는 힘을 키우는 운동이에요.",
  레그컬: "허벅지 뒤쪽(햄스트링)을 굽히는 힘을 키우는 운동이에요.",
  레그프레스: "엉덩이와 허벅지 전체를 밀어내는 하체 힘을 키우는 운동이에요.",
  힙어브덕션: "엉덩이 옆쪽 근육을 벌려 골반 안정성을 높이는 운동이에요.",
  힙어덕션: "허벅지 안쪽 근육을 모아주는 힘을 키우는 운동이에요.",
  글루트머신: "엉덩이 근육을 집중적으로 키우는 운동이에요.",
};

interface Props {
  sessions: Session[];
  recordsBySession: Record<string, ExerciseRecord[]>;
  /** 메인 3대 운동(성별별 SBD)과 이름이 겹치는 보조 종목은 중복 집계되지 않도록 제외 */
  excludeNames?: string[];
}

interface SupportLog {
  date: string;
  actualWeight: number;
  reps: number;
  scoreKg: number;
}

interface ExerciseCard {
  name: string;
  start: number;
  current: number;
  growth: number;
  growthPct: number;
  data: { date: string; val: number; actualWeight: number; reps: number }[];
  isReverse: boolean;
  lastDate: string;
  streak: number;
  logs: SupportLog[];
}

/* ═══════════════════════════════════════════════════════════════
   Named Export — GrowthTab 등에서 { SupportCarousel }로 import
   ═══════════════════════════════════════════════════════════════ */
export function SupportCarousel({ sessions, recordsBySession, excludeNames = [] }: Props) {
  const [tab, setTab] = useState<"upper" | "lower">("upper");
  const [expandedName, setExpandedName] = useState<string | null>(null);

  const exercises = (tab === "upper" ? UPPER_EXERCISES : LOWER_EXERCISES).filter(
    (ex) => !excludeNames.includes(ex)
  );

  /* ─── 종목별 데이터 계산 ─── */
  const cards: ExerciseCard[] = useMemo(() => {
    const completed = sessions
      .filter((s) => s.status === "completed")
      .sort((a, b) => a.date.localeCompare(b.date));

    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const fwa = fourWeeksAgo.toISOString().slice(0, 10);

    return exercises
      .map((ex) => {
        const isReverse = PULLUP_NAMES.includes(ex);
        const sessionMax: {
          date: string;
          val: number;
          rawDate: string;
          actualWeight: number;
          reps: number;
        }[] = [];

        completed.forEach((s) => {
          const recs = (recordsBySession[s.id] ?? []).filter(
            (r) => r.exercise_name === ex
          );
          if (recs.length === 0) return;

          let sessionVal: number;
          let actualWeight = 0;
          let reps = 0;
          if (isReverse) {
            // 풀업: 보조 무게 낮을수록 강함 → 역산 (40kg → 점수 60, 20kg → 80)
            const withWeight = recs.filter((r) => (r.weight ?? 0) > 0);
            if (withWeight.length === 0) return;
            const bestRec = withWeight.reduce((a, b) => ((a.weight ?? 0) <= (b.weight ?? 0) ? a : b));
            sessionVal = Math.max(0, 100 - (bestRec.weight ?? 0));
            actualWeight = bestRec.weight ?? 0;
            reps = bestRec.reps ?? 0;
          } else {
            let bestORM = 0;
            recs.forEach((r) => {
              const orm = calcOneRM(r.weight ?? 0, r.reps ?? 0);
              if (orm > bestORM) {
                bestORM = orm;
                actualWeight = r.weight ?? 0;
                reps = r.reps ?? 0;
              }
            });
            sessionVal = bestORM;
          }
          if (sessionVal <= 0) return;

          sessionMax.push({
            date: `${s.date.slice(5, 7)}/${s.date.slice(8, 10)}`,
            val: sessionVal,
            rawDate: s.date,
            actualWeight,
            reps,
          });
        });

        if (sessionMax.length === 0) return null;

        // 최근 연속 증량(혹은 풀업처럼 역산 종목이면 연속 강도 향상) 횟수
        let streak = 0;
        for (let i = sessionMax.length - 1; i > 0; i--) {
          if (sessionMax[i].val >= sessionMax[i - 1].val) streak++;
          else break;
        }
        if (sessionMax.length > 0) streak += 1; // 가장 최근 기록 자체도 포함

        const start = sessionMax[0]?.val ?? 0;
        const current = sessionMax[sessionMax.length - 1].val;
        const pastVal =
          (sessionMax.find((p) => p.rawDate >= fwa) ?? sessionMax[0]).val;
        // 역산 종목(풀업 등)도 이미 변환된 점수 기준이라 동일하게 시작 대비 증가분 계산
        const growth = Math.round(current - start);
        const growthPct =
          pastVal > 0
            ? Math.round(((current - pastVal) / pastVal) * 100 * 10) / 10
            : 0;

        // 세션별 실제 수행 내역 — 아코디언 상세 리스트용 (최신순)
        const logs: SupportLog[] = [...sessionMax].reverse().map((p) => ({
          date: `${parseInt(p.rawDate.slice(5, 7), 10)}월 ${parseInt(p.rawDate.slice(8, 10), 10)}일`,
          actualWeight: p.actualWeight,
          reps: p.reps,
          scoreKg: Math.round(p.val),
        }));

        return {
          name: ex,
          start: Math.round(start),
          current: Math.round(current),
          growth,
          growthPct,
          data: sessionMax.map((p) => ({
            date: p.date,
            val: p.val,
            actualWeight: p.actualWeight,
            reps: p.reps,
          })),
          isReverse,
          lastDate: sessionMax[sessionMax.length - 1]?.rawDate ?? "",
          streak,
          logs,
        } as ExerciseCard;
      })
      .filter((c): c is ExerciseCard => c !== null)
      // 성장 폭 큰 종목 순으로 정렬 — 기록 있는 종목 전부 랭킹으로 노출
      .sort((a, b) => Math.abs(b.growthPct) - Math.abs(a.growthPct));
  }, [sessions, recordsBySession, exercises, tab]);

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <span className="font-cond font-bold text-ink-0" style={{ fontSize: 17 }}>
        보조 종목
      </span>

      {/* 상체 / 하체 세그먼트 컨트롤 */}
      <div
        className="flex p-1 rounded-xl gap-1"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {(["upper", "lower"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "tap-haptic flex-1 py-2.5 rounded-lg font-cond font-bold text-sm tracking-wider leading-none transition-all"
            )}
            style={
              tab === t
                ? {
                    background: "rgba(255,255,255,0.10)",
                    color: "var(--ink-0)",
                    boxShadow:
                      "0 1px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
                  }
                : { color: "var(--ink-3)" }
            }
          >
            {t === "upper" ? "상체" : "하체"}
          </button>
        ))}
      </div>

      {/* 종목 리스트 — 통카드 (divide-y) */}
      {cards.length === 0 ? (
        <div className="pt-card text-center py-6">
          <p className="text-ink-3 font-cond text-sm">해당 종목 기록이 없습니다</p>
        </div>
      ) : (
        <div className="pt-card" style={{ padding: 4 }}>
          {cards.map((card) => (
            <SupportRow
              key={card.name}
              card={card}
              expanded={expandedName === card.name}
              onToggle={() => setExpandedName((prev) => (prev === card.name ? null : card.name))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   종목 한 행 — 접힌 상태: 종목명 · 현재 기록 · 변화율만
   펼친 상태: 스파크라인 + 세션별 실제 수행 내역
   ═══════════════════════════════════════════════════════════════ */
function SupportRow({
  card,
  expanded,
  onToggle,
}: {
  card: ExerciseCard;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [showAllLogs, setShowAllLogs] = useState(false);
  const gradId = `sg-${card.name.replace(/\s/g, "_").replace(/[^\w]/g, "")}`;
  const unit = card.isReverse ? "pt" : "kg";
  const visibleLogs = showAllLogs ? card.logs : card.logs.slice(0, LOG_PREVIEW_COUNT);

  return (
    <div
      style={{ borderTop: "1px solid var(--pt-5)" }}
      className="first:border-t-0"
    >
      <button
        type="button"
        onClick={onToggle}
        className="tap-haptic w-full flex items-center justify-between gap-3 px-3.5 py-3.5"
      >
        <span className="text-sm font-bold text-ink-0 truncate text-left">
          {card.name}
        </span>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="font-mono-num font-extrabold tabular-nums text-ink-0" style={{ fontSize: 15 }}>
            {card.current}
            <span className="text-[10px] font-cond font-bold text-ink-4 ml-0.5">{unit}</span>
          </span>
          {card.growthPct !== 0 && (
            <span
              className="font-mono-num font-bold px-1.5 py-0.5 rounded text-[10px] leading-none tabular-nums"
              style={{
                color: card.growthPct > 0 ? VOLT : "var(--ink-3)",
                background: card.growthPct > 0 ? "rgba(211,255,82,0.1)" : "rgba(255,255,255,0.05)",
              }}
            >
              {card.growthPct > 0 ? "+" : ""}{card.growthPct}%
            </span>
          )}
          {expanded ? (
            <ChevronUp size={15} className="text-ink-3" />
          ) : (
            <ChevronDown size={15} className="text-ink-3" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-3.5 pb-4 flex flex-col gap-3">
          {/* 쉬운 한글 설명 */}
          {EXERCISE_DESC[card.name] && (
            <p className="text-[11px] text-ink-3 leading-relaxed">
              {EXERCISE_DESC[card.name]}
            </p>
          )}

          {/* 시작 → 현재 */}
          <div
            className="flex items-baseline gap-1.5 flex-wrap rounded-2xl px-3 py-2.5"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--pt-5)" }}
          >
            <span className="text-[11px] text-ink-4 font-cond">시작 {card.start}{unit}</span>
            <span className="text-ink-4 text-[11px]">➔</span>
            <span className="font-mono-num font-extrabold text-ink-0" style={{ fontSize: 15 }}>
              {card.current}{unit}
            </span>
            {card.streak >= 2 && (
              <span className="text-[10px] font-cond font-bold text-ink-3 ml-auto">
                {card.streak}회 연속 {card.isReverse ? "강도 향상" : "증량"}
              </span>
            )}
          </div>

          {/* 스파크라인 */}
          <div className="rounded-2xl p-3" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--pt-5)" }}>
            <div className="w-full" style={{ height: 88 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={card.data} margin={{ top: 10, right: 10, left: 10, bottom: 2 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={VOLT} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={VOLT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    content={(props) => <SparkTooltip {...props} isReverse={card.isReverse} />}
                    cursor={{ stroke: VOLT, strokeOpacity: 0.25 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="val"
                    stroke={VOLT}
                    strokeWidth={2.5}
                    fill={`url(#${gradId})`}
                    dot={{ r: 3.5, fill: VOLT, stroke: "#000", strokeWidth: 1.5 }}
                    activeDot={{ r: 6, fill: VOLT, stroke: "#000", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 세션별 실제 수행 내역 */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-cond font-bold text-ink-3">
              세션별 실제 수행 내역 ({card.logs.length}회)
            </p>
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--pt-5)" }}>
              {visibleLogs.map((log, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-2.5 text-xs"
                  style={idx > 0 ? { borderTop: "1px solid rgba(255,255,255,0.05)" } : undefined}
                >
                  <span className="text-ink-3 font-cond font-semibold">{log.date}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num font-bold text-ink-0 tabular-nums">
                      {log.actualWeight}kg × {log.reps}회
                    </span>
                    <span
                      className="font-mono-num font-bold text-[10px] px-2 py-0.5 rounded-full tabular-nums"
                      style={{ background: "rgba(211,255,82,0.1)", color: VOLT }}
                    >
                      {card.isReverse ? `점수 ${log.scoreKg}pt` : `1RM ${log.scoreKg}kg`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {card.logs.length > LOG_PREVIEW_COUNT && (
              <button
                type="button"
                onClick={() => setShowAllLogs((v) => !v)}
                className="tap-haptic text-[11px] font-cond font-bold text-ink-3 text-center py-1.5"
              >
                {showAllLogs ? "접기" : `전체 기록 보기 (${card.logs.length}건)`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   스파크라인 커스텀 툴팁 — 호버/터치 시 날짜·수행 중량×횟수·추정 1RM 표시
   ═══════════════════════════════════════════════════════════════ */
function SparkTooltip({
  active,
  payload,
  isReverse,
}: {
  active?: boolean;
  payload?: { payload?: { date: string; val: number; actualWeight: number; reps: number } }[];
  isReverse: boolean;
}) {
  if (!active || !payload || payload.length === 0 || !payload[0].payload) return null;
  const row = payload[0].payload;

  return (
    <div
      className="rounded-xl px-3 py-2"
      style={{
        background: "rgba(10,10,10,0.95)",
        border: "1px solid var(--pt-6)",
        backdropFilter: "blur(12px)",
      }}
    >
      <p className="text-[10px] font-cond font-bold text-ink-3 mb-1 leading-none">{row.date}</p>
      <p className="text-xs font-mono-num font-bold text-ink-0 tabular-nums leading-none mb-1">
        {row.actualWeight}kg{isReverse ? " 보조" : ""} × {row.reps}회
      </p>
      <p className="text-[11px] font-mono-num font-bold tabular-nums leading-none" style={{ color: VOLT }}>
        {isReverse ? `점수 ${Math.round(row.val)}pt` : `추정 1RM ${Math.round(row.val)}kg`}
      </p>
    </div>
  );
}
