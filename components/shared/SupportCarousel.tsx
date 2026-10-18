"use client";

import { useMemo, useState } from "react";
import { Flame } from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";
import type { Session, ExerciseRecord } from "@/lib/types";
import { calcOneRM } from "@/lib/types";
import { cn } from "@/lib/utils";

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

interface Props {
  sessions: Session[];
  recordsBySession: Record<string, ExerciseRecord[]>;
}

interface ExerciseCard {
  name: string;
  color: string;
  start: number;
  current: number;
  growth: number;
  growthPct: number;
  data: { date: string; val: number }[];
  isReverse: boolean;
  lastDate: string;
  streak: number;
}

/* ═══════════════════════════════════════════════════════════════
   Named Export — GrowthTab 등에서 { SupportCarousel }로 import
   ═══════════════════════════════════════════════════════════════ */
export function SupportCarousel({ sessions, recordsBySession }: Props) {
  const [tab, setTab] = useState<"upper" | "lower">("upper");

  const exercises = tab === "upper" ? UPPER_EXERCISES : LOWER_EXERCISES;

  /* ─── 종목별 카드 데이터 계산 ─── */
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
        const sessionMax: { date: string; val: number; rawDate: string }[] = [];

        completed.forEach((s) => {
          const recs = (recordsBySession[s.id] ?? []).filter(
            (r) => r.exercise_name === ex
          );
          if (recs.length === 0) return;

          let sessionVal: number;
          if (isReverse) {
            // 풀업: 보조 무게 낮을수록 강함 → 역산 (40kg → 점수 60, 20kg → 80)
            const weights = recs.map((r) => r.weight ?? 0).filter((w) => w > 0);
            if (weights.length === 0) return;
            sessionVal = Math.max(0, 100 - Math.min(...weights));
          } else {
            sessionVal = Math.max(
              ...recs.map((r) => calcOneRM(r.weight ?? 0, r.reps ?? 0))
            );
          }
          if (sessionVal <= 0) return;

          sessionMax.push({
            date: `${s.date.slice(5, 7)}/${s.date.slice(8, 10)}`,
            val: sessionVal,
            rawDate: s.date,
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

        return {
          name: ex,
          color: tab === "upper" ? "#94a3b8" : "#7dd3fc",
          start: Math.round(start),
          current: Math.round(current),
          growth,
          growthPct,
          data: sessionMax.map((p) => ({ date: p.date, val: p.val })),
          isReverse,
          lastDate: sessionMax[sessionMax.length - 1]?.rawDate ?? "",
          streak,
        } as ExerciseCard;
      })
      .filter((c): c is ExerciseCard => c !== null)
      // 성장 폭 큰 종목 순으로 정렬 — TOP 3만 노출
      .sort((a, b) => Math.abs(b.growthPct) - Math.abs(a.growthPct))
      .slice(0, 3);
  }, [sessions, recordsBySession, exercises, tab]);

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <span className="font-cond font-bold text-ink-3 tracking-widest uppercase leading-none" style={{ fontSize: 11 }}>
            SUPPORT EXERCISES
          </span>
          <p className="text-[11px] font-cond text-ink-3 leading-none">
            보조 종목 성장 순위 (TOP 3)
          </p>
        </div>
      </div>

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

      {/* TOP 3 랭킹 리스트 (1열 풀 너비) */}
      {cards.length === 0 ? (
        <div className="pt-card text-center py-6">
          <p className="text-ink-3 font-cond text-sm">해당 종목 기록이 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* key={card.name} — React 고유 번호표 */}
          {cards.map((card, i) => (
            <SupportRankCard key={card.name} rank={i + 1} card={card} category={tab} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   단일 랭킹 카드 컴포넌트 — TOP N 뱃지 + 시작➔현재 서사 + 스파크라인
   ═══════════════════════════════════════════════════════════════ */
function SupportRankCard({
  rank,
  card,
  category,
}: {
  rank: number;
  card: ExerciseCard;
  category: "upper" | "lower";
}) {
  // linearGradient id — 카드별로 고유하게 (한글 종목명 → ASCII 변환)
  const gradId = `sg-${card.name.replace(/\s/g, "_").replace(/[^\w]/g, "")}`;
  const unit = card.isReverse ? "pt" : "kg";

  return (
    <div
      className="pt-card flex items-center justify-between gap-3"
      style={{ padding: 18 }}
    >
      {/* 좌측: 순위/카테고리/성장률 + 종목명 + 시작➔현재 서사 */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="font-mono-num font-extrabold px-2 py-0.5 rounded-full text-[10px] leading-none shrink-0"
            style={
              rank === 1
                ? { background: "var(--volt)", color: "#000" }
                : { background: "var(--pt-3)", color: "var(--ink-2)", border: "1px solid var(--pt-5)" }
            }
          >
            TOP {rank}
          </span>
          <span className="text-[10px] font-cond font-bold text-ink-3">
            {category === "upper" ? "상체" : "하체"}
          </span>
          {card.growthPct !== 0 && (
            <span
              className="font-mono-num font-bold px-1.5 py-0.5 rounded text-[9px] leading-none"
              style={{
                background: card.growthPct > 0 ? `${card.color}1A` : "rgba(255,80,80,0.1)",
                color: card.growthPct > 0 ? card.color : "#ff8080",
              }}
            >
              {card.growthPct > 0 ? "+" : ""}{card.growthPct}%
            </span>
          )}
        </div>

        <p className="font-bold text-ink-0 text-sm truncate">
          {card.isReverse ? "⬆ " : ""}{card.name}
        </p>

        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-[11px] text-ink-4 font-cond">시작 {card.start}{unit}</span>
          <span className="text-ink-4 text-[11px]">➔</span>
          <span className="font-mono-num font-extrabold text-ink-0" style={{ fontSize: 17 }}>
            {card.current}
          </span>
          <span className="text-[10px] font-cond font-bold text-ink-4">{unit}</span>
          {card.growth !== 0 && (
            <span className="font-mono-num font-bold ml-1" style={{ fontSize: 11, color: card.color }}>
              {card.growth > 0 ? "+" : ""}{card.growth}{unit} {card.growth > 0 ? "증량" : "조정"}
            </span>
          )}
        </div>
      </div>

      {/* 우측: 연속 갱신 뱃지 + 스파크라인 */}
      <div className="flex flex-col items-end gap-2 shrink-0" style={{ width: 108 }}>
        {card.streak >= 2 ? (
          <span
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-cond font-bold leading-none whitespace-nowrap"
            style={{ background: "rgba(255,140,0,0.1)", color: "var(--warn)", border: "1px solid rgba(255,140,0,0.25)" }}
          >
            <Flame size={10} className="shrink-0" />
            {card.streak}회 연속 {card.isReverse ? "강도 향상" : "증량"}
          </span>
        ) : (
          <span className="text-[9px] font-cond text-ink-4 leading-none whitespace-nowrap">
            최근 갱신 {card.lastDate.slice(5)}
          </span>
        )}
        <div className="w-full" style={{ height: 36 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={card.data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={card.color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={card.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="val" stroke={card.color} strokeWidth={2}
                fill={`url(#${gradId})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
