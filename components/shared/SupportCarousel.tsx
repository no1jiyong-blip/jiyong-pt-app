"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
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
  current: number;
  growth: number;
  growthPct: number;
  data: { date: string; val: number }[];
  isReverse: boolean;
  lastDate: string;
}

/* ═══════════════════════════════════════════════════════════════
   Named Export — GrowthTab 등에서 { SupportCarousel }로 import
   ═══════════════════════════════════════════════════════════════ */
export function SupportCarousel({ sessions, recordsBySession }: Props) {
  const [tab, setTab] = useState<"upper" | "lower">("upper");
  const scrollRef = useRef<HTMLDivElement>(null);

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

        const current = sessionMax[sessionMax.length - 1].val;
        const pastVal =
          (sessionMax.find((p) => p.rawDate >= fwa) ?? sessionMax[0]).val;
        const growth = isReverse
          ? 0
          : Math.round(current - (sessionMax[0]?.val ?? 0));
        const growthPct =
          pastVal > 0
            ? Math.round(((current - pastVal) / pastVal) * 100 * 10) / 10
            : 0;

        return {
          name: ex,
          color: tab === "upper" ? "#94a3b8" : "#7dd3fc",
          current: Math.round(current),
          growth,
          growthPct,
          data: sessionMax.map((p) => ({ date: p.date, val: p.val })),
          isReverse,
          lastDate: sessionMax[sessionMax.length - 1]?.rawDate ?? "",
        } as ExerciseCard;
      })
      .filter((c): c is ExerciseCard => c !== null)
      // 성장 폭 큰 종목 순으로 정렬
      .sort((a, b) => Math.abs(b.growthPct) - Math.abs(a.growthPct));
  }, [sessions, recordsBySession, exercises, tab]);

  /* ─── 좌우 스크롤 ─── */
  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "left" ? -280 : 280,
      behavior: "smooth",
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 + 스크롤 버튼 */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-xl text-ink-0 tracking-wide leading-none uppercase">
            SUPPORT CARDS
          </h3>
          <p className="text-[11px] font-cond text-ink-3 leading-none">
            보조 종목 · 성장 폭 큰 순 정렬
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => scroll("left")}
            className="tap-haptic w-9 h-9 rounded-xl bg-pt-3 border border-pt-5 flex items-center justify-center text-ink-2"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => scroll("right")}
            className="tap-haptic w-9 h-9 rounded-xl bg-pt-3 border border-pt-5 flex items-center justify-center text-ink-2"
          >
            <ChevronRight size={15} />
          </button>
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

      {/* 캐러셀 */}
      {cards.length === 0 ? (
        <div className="pt-card text-center py-6">
          <p className="text-ink-3 font-cond text-sm">해당 종목 기록이 없습니다</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            paddingBottom: 4,
          }}
        >
          {/* key={card.name} — React 고유 번호표 */}
          {cards.map((card) => (
            <SupportCard key={card.name} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   단일 카드 컴포넌트
   ═══════════════════════════════════════════════════════════════ */
function SupportCard({ card }: { card: ExerciseCard }) {
  const [expanded, setExpanded] = useState(false);

  // linearGradient id — 카드별로 고유하게 (한글 종목명 → ASCII 변환)
  const gradId = `sg-${card.name.replace(/\s/g, "_").replace(/[^\w]/g, "")}`;

  return (
    <div
      className="flex flex-col gap-4 shrink-0 tap-haptic cursor-pointer"
      style={{
        width: 220,
        background: "rgba(20,20,20,0.78)",
        backdropFilter: "blur(16px)",
        border: expanded
          ? `1px solid ${card.color}60`
          : "1px solid var(--pt-5)",
        borderRadius: 20,
        padding: 18,
        transition: "all 0.2s",
      }}
      onClick={() => setExpanded((v) => !v)}
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-2 min-w-0">
          <p
            className="font-cond font-bold text-[11px] uppercase tracking-wider leading-none truncate"
            style={{ color: card.color }}
          >
            {card.isReverse ? "⬆ " : ""}{card.name}
          </p>
          <p
            className="font-display tabular-nums leading-none"
            style={{ fontSize: 26, color: "var(--ink-0)" }}
          >
            {card.current}
            <span className="text-ink-3 text-[10px] ml-1 font-cond">
              {card.isReverse ? "pt" : "kg"}
            </span>
          </p>
        </div>
        {card.growthPct !== 0 && (
          <div
            className="px-2.5 py-1.5 rounded-full text-[10px] font-cond font-bold leading-none shrink-0"
            style={{
              background:
                card.growthPct > 0 ? `${card.color}20` : "rgba(255,80,80,0.1)",
              color: card.growthPct > 0 ? card.color : "#ff8080",
              border: `1px solid ${card.growthPct > 0 ? card.color : "#ff8080"}40`,
            }}
          >
            {card.growthPct > 0 ? "+" : ""}
            {card.growthPct}%
          </div>
        )}
      </div>

      {/* 미니 스파크라인 (항상 노출) */}
      <ResponsiveContainer width="100%" height={70}>
        <AreaChart
          data={card.data}
          margin={{ top: 4, right: 2, left: -30, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={card.color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={card.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="val"
            stroke={card.color}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
          {expanded && (
            <XAxis
              dataKey="date"
              tick={{
                fill: "#555",
                fontSize: 8,
                fontFamily: "Barlow Condensed",
              }}
              axisLine={false}
              tickLine={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>

      {/* 확장 시 상세 정보 */}
      {expanded && (
        <div className="flex flex-col gap-2 border-t border-pt-5 pt-3">
          {card.isReverse && (
            <p className="text-[9px] font-cond text-ink-3 leading-relaxed">
              ↑ 보조 무게 감소 = 강도 향상
            </p>
          )}
          <div className="flex items-center gap-2 text-[10px] font-cond text-ink-3 leading-none">
            <TrendingUp size={10} style={{ color: card.color }} />
            <span>최근 갱신 {card.lastDate.slice(5)}</span>
          </div>
          {!card.isReverse && card.growth > 0 && (
            <p className="text-[10px] font-cond leading-none">
              <span className="text-ink-3">총 성장 </span>
              <span className="font-bold" style={{ color: card.color }}>
                +{card.growth}kg
              </span>
            </p>
          )}
        </div>
      )}

      {/* 접기/펼치기 힌트 */}
      <p className="text-[9px] font-cond text-ink-4 leading-none text-center">
        {expanded ? "▲ 접기" : "▼ 상세 보기"}
      </p>
    </div>
  );
}
