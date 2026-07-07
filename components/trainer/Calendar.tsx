"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, getTodayISO } from "@/lib/utils";
import type { Session } from "@/lib/types";

interface Props {
  sessions: Session[];
  selectedDate: string;
  onSelectDate: (d: string) => void;
}

export function Calendar({ sessions, selectedDate, onSelectDate }: Props) {
  const today = getTodayISO();
  const [current, setCurrent] = useState(new Date(selectedDate || today));

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const pad = (n: number) => String(n).padStart(2, "0");
  const toISO = (day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

  const sessionsByDate = new Set(sessions.map((s) => s.date));

  return (
    <div className="pt-card flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrent(new Date(year, month - 1, 1))}
          className="w-11 h-11 rounded-full bg-pt-2 flex items-center justify-center text-ink-1 hover:bg-pt-4"
        >
          <ChevronLeft size={18} />
        </button>
        <h3 className="font-display text-xl text-ink-0 tracking-wider leading-none">
          {year}년 {month + 1}월
        </h3>
        <button
          onClick={() => setCurrent(new Date(year, month + 1, 1))}
          className="w-11 h-11 rounded-full bg-pt-2 flex items-center justify-center text-ink-1 hover:bg-pt-4"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
          <div
            key={d}
            className="text-center text-[11px] font-cond font-bold py-2 leading-none"
            style={{
              color:
                i === 0 ? "#ff5577" : i === 6 ? "#4488ff" : "var(--ink-2)",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="h-11" />;
          const iso = toISO(day);
          const hasSession = sessionsByDate.has(iso);
          const isToday = iso === today;
          const isSelected = iso === selectedDate;

          return (
            <button
              key={iso}
              onClick={() => onSelectDate(iso)}
              className={cn(
                "h-11 rounded-full font-cond font-bold text-sm transition-all relative leading-none",
                isSelected ? "text-black" : isToday ? "text-volt" : "text-ink-1"
              )}
              style={{
                background: isSelected ? "var(--grad-volt)" : "transparent",
                boxShadow: isSelected ? "0 0 18px var(--volt-glow-2)" : "none",
              }}
            >
              {day}
              {hasSession && !isSelected && (
                <span
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ backgroundColor: "var(--volt)" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
