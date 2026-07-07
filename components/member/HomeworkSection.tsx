"use client";

import { useState } from "react";
import { Check, MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Homework } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  homework: Homework[];
  trainerNote?: string | null;
  onUpdate: () => void;
}

export function HomeworkSection({ homework, trainerNote, onUpdate }: Props) {
  const [items, setItems] = useState(homework);
  const completedCount = items.filter((h) => h.is_completed).length;

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

  if (items.length === 0 && !trainerNote) return null;

  return (
    <section className="px-6 flex flex-col gap-5">
      <h2 className="section-title">
        <span className="section-bar-pink"></span>
        이주의 숙제
      </h2>

      <div className="pt-card flex flex-col gap-5">
        {items.length > 0 && (
          <p className="font-display text-volt text-lg tracking-wider leading-none">
            {completedCount}/{items.length} 완료
          </p>
        )}

        <div className="flex flex-col gap-3">
          {items.map((hw) => (
            <button
              key={hw.id}
              onClick={() => toggle(hw)}
              className={cn(
                "w-full flex items-center gap-4 p-5 rounded-2xl border transition-all text-left",
                hw.is_completed
                  ? "bg-volt-glow border-volt-soft"
                  : "bg-pt-2 border-pt-5 hover:border-pt-6"
              )}
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

        {trainerNote && (
          <div
            className="rounded-2xl p-5 border-2 flex flex-col gap-3 mt-2"
            style={{
              background:
                "linear-gradient(135deg, rgba(211,255,82,0.08) 0%, rgba(211,255,82,0.02) 100%)",
              borderColor: "var(--volt-glow-2)",
            }}
          >
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-volt" />
              <p className="text-xs font-cond font-bold text-volt tracking-wider leading-none">
                트레이너 메모
              </p>
            </div>
            <p className="text-ink-1 text-sm leading-relaxed">{trainerNote}</p>
          </div>
        )}
      </div>
    </section>
  );
}
