"use client";

import { MessageSquare, Target } from "lucide-react";
import { BrandLogo } from "@/components/shared/BrandLogo";

interface Props {
  trainerAssessment: string | null;
  weeklyMission: string | null;
}

export function TrainerAssessmentCard({
  trainerAssessment,
  weeklyMission,
}: Props) {
  if (!trainerAssessment && !weeklyMission) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* 트레이너 소견 */}
      {trainerAssessment && (
        <div
          className="pt-card flex flex-col gap-4 relative"
          style={{
            padding: 24,
            background:
              "linear-gradient(160deg, rgba(211,255,82,0.09) 0%, rgba(20,20,20,0.88) 70%)",
            borderColor: "var(--volt-glow-2)",
          }}
        >
          {/* 말풍선 꼬리 (하단 왼쪽) */}
          <div className="flex items-center gap-3">
            <BrandLogo size={36} glow="soft" />
            <div className="flex flex-col gap-1">
              <p
                className="text-[10px] font-cond font-bold text-volt tracking-wide-2 uppercase leading-none"
              >
                JIYONG PT — 트레이너 재활 소견
              </p>
              <p className="text-[10px] font-cond text-ink-3 leading-none">
                신지용 · 재활 운동 전문가 9년
              </p>
            </div>
          </div>

          <div
            className="rounded-2xl p-5 flex flex-col gap-2"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(211,255,82,0.15)",
            }}
          >
            <MessageSquare size={12} className="text-volt" />
            <p className="text-sm text-ink-0 leading-relaxed">
              {trainerAssessment}
            </p>
          </div>
        </div>
      )}

      {/* 이번 주 핵심 미션 */}
      {weeklyMission && (
        <div
          className="pt-card flex flex-col gap-4"
          style={{
            padding: 22,
            background:
              "linear-gradient(160deg, rgba(91,168,255,0.08) 0%, rgba(20,20,20,0.88) 70%)",
            borderColor: "rgba(91,168,255,0.30)",
          }}
        >
          <div className="flex items-center gap-2">
            <Target size={14} className="text-info" />
            <p className="text-[10px] font-cond font-bold text-info tracking-wide-2 uppercase leading-none">
              이번 주 핵심 미션
            </p>
          </div>
          <p className="text-sm text-ink-0 leading-relaxed font-cond font-bold">
            {weeklyMission}
          </p>
        </div>
      )}
    </div>
  );
}
