"use client";

import { useState } from "react";
import { Check, MessageSquare, Apple, Droplet, Moon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Homework } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TabHeader } from "@/components/member/TabHeader";

interface Props {
  homework: Homework[];
  trainerNote?: string | null;
  onUpdate: () => void;
}

export function MissionTab({ homework, trainerNote, onUpdate }: Props) {
  const [items, setItems] = useState(homework);
  const completedCount = items.filter((h) => h.is_completed).length;
  const allCompleted = items.length > 0 && completedCount === items.length;

  const toggle = async (hw: Homework) => {
    const newVal = !hw.is_completed;
    setItems((prev) =>
      prev.map((h) => (h.id === hw.id ? { ...h, is_completed: newVal } : h))
    );
    const { error } = await supabase
      .from("homework")
      .update({ is_completed: newVal })
      .eq("id", hw.id);
    if (error) {
      setItems((prev) =>
        prev.map((h) => (h.id === hw.id ? { ...h, is_completed: !newVal } : h))
      );
    } else {
      onUpdate();
    }
  };

  return (
    <div className="anim-tab-slide flex flex-col gap-8 px-6 pt-2">
      {/* ─── 헤더 ─── */}
      <TabHeader
        title="WEEKLY MISSION"
        subtitle="꾸준한 작은 습관이 큰 변화를 만듭니다"
      />

      {/* ─── 이주의 숙제 ─── */}
      <section className="flex flex-col gap-5">
        <h2 className="section-title">
          <span className="section-bar-pink"></span>
          이주의 숙제
        </h2>

        <div
          className={cn(
            "pt-card-xl flex flex-col gap-5",
            allCompleted && "anim-shimmer-border"
          )}
          style={
            allCompleted
              ? { borderColor: "var(--volt)", background: "var(--grad-card-hot)" }
              : undefined
          }
        >
          {items.length > 0 ? (
            <>
              <div className="flex items-end justify-between gap-3">
                <p className="font-display text-volt text-3xl tracking-wider leading-none">
                  {completedCount}
                  <span className="text-ink-3 text-base ml-1">
                    / {items.length}
                  </span>
                </p>
                {allCompleted && (
                  <span
                    className="px-3 py-1.5 rounded-full font-cond font-bold text-xs tracking-wider leading-none"
                    style={{
                      background: "var(--grad-volt)",
                      color: "#000",
                      boxShadow: "0 0 12px var(--volt-glow-2)",
                    }}
                  >
                    🔥 모두 완료!
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {items.map((hw) => (
                  <button
                    key={hw.id}
                    onClick={() => toggle(hw)}
                    className={cn(
                      "tap-haptic w-full flex items-center gap-4 p-5 rounded-2xl border transition-all text-left",
                      hw.is_completed
                        ? "anim-shimmer-border"
                        : "bg-pt-2 border-pt-5 hover:border-pt-6"
                    )}
                    style={
                      hw.is_completed
                        ? {
                            background: "var(--grad-card-hot)",
                            borderColor: "var(--volt-glow-2)",
                          }
                        : undefined
                    }
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-all",
                        hw.is_completed
                          ? "border-volt"
                          : "border-pt-6 bg-transparent"
                      )}
                      style={{
                        background: hw.is_completed
                          ? "var(--grad-volt)"
                          : undefined,
                      }}
                    >
                      {hw.is_completed && (
                        <Check size={15} strokeWidth={3} color="#000" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "flex-1 text-sm leading-relaxed",
                        hw.is_completed
                          ? "text-ink-3 line-through"
                          : "text-ink-0"
                      )}
                    >
                      {hw.content}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-ink-3 text-sm font-cond text-center py-4">
              이번 주 등록된 숙제가 없습니다
            </p>
          )}

          {trainerNote && (
            <div
              className="rounded-2xl p-5 border-2 flex flex-col gap-3 mt-2"
              style={{
                background:
                  "linear-gradient(135deg, rgba(211,255,82,0.10) 0%, rgba(211,255,82,0.02) 100%)",
                borderColor: "var(--volt-glow-2)",
              }}
            >
              <div className="flex items-center gap-2">
                <MessageSquare size={14} className="text-volt" />
                <p className="text-xs font-cond font-bold text-volt tracking-wider leading-none">
                  트레이너 메모
                </p>
              </div>
              <p className="text-ink-1 text-sm leading-relaxed">
                {trainerNote}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ─── 식단 / 라이프스타일 가이드 ─── */}
      <section className="flex flex-col gap-5">
        <h2 className="section-title">
          <span className="section-bar-blue"></span>
          식단 & 라이프스타일
        </h2>

        <div className="grid grid-cols-1 gap-4">
          <GuideCard
            Icon={Apple}
            title="단백질 섭취"
            value="체중 × 1.5g"
            description="근성장을 위한 일일 단백질 권장량. 닭가슴살, 계란, 두부 등으로 분산 섭취하세요."
            tone="green"
          />
          <GuideCard
            Icon={Droplet}
            title="수분 섭취"
            value="2.5L 이상"
            description="운동 중 탈수는 근력 저하의 주된 원인. 물 부족은 회복도 늦춥니다."
            tone="blue"
          />
          <GuideCard
            Icon={Moon}
            title="수면"
            value="7~9시간"
            description="근육은 수면 중 회복합니다. 수면 부족은 곧 운동 효과 반감."
            tone="indigo"
          />
        </div>
      </section>
    </div>
  );
}

/* ─── Guide Card ──────────────────────────────── */
function GuideCard({
  Icon,
  title,
  value,
  description,
  tone,
}: {
  Icon: typeof Apple;
  title: string;
  value: string;
  description: string;
  tone: "green" | "blue" | "indigo";
}) {
  const colors = {
    green: { bg: "rgba(211,255,82,0.08)", border: "rgba(211,255,82,0.25)", icon: "var(--volt)" },
    blue: { bg: "rgba(68,136,255,0.08)", border: "rgba(68,136,255,0.25)", icon: "var(--info)" },
    indigo: { bg: "rgba(140,120,255,0.08)", border: "rgba(140,120,255,0.25)", icon: "#8c78ff" },
  }[tone];

  return (
    <div
      className="pt-card-xl flex items-start gap-4"
      style={{ background: colors.bg, borderColor: colors.border }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: `1px solid ${colors.border}`,
        }}
      >
        <Icon size={20} style={{ color: colors.icon }} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="font-cond font-bold text-ink-0 text-sm leading-none">
            {title}
          </p>
          <p
            className="font-display text-lg leading-none"
            style={{ color: colors.icon }}
          >
            {value}
          </p>
        </div>
        <p className="text-xs text-ink-2 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
