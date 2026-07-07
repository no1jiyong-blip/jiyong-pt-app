"use client";

import { Home, Dumbbell, TrendingUp, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabKey = "home" | "workout" | "growth" | "mission";

interface Props {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

const TABS: {
  key: TabKey;
  label: string;
  Icon: typeof Home;
}[] = [
  { key: "home", label: "Home", Icon: Home },
  { key: "workout", label: "Workout", Icon: Dumbbell },
  { key: "growth", label: "Growth", Icon: TrendingUp },
  { key: "mission", label: "Mission", Icon: Target },
];

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
      <div
        className="glass pointer-events-auto bottom-nav-safe w-full max-w-[640px] mx-auto"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-stretch px-2">
          {TABS.map(({ key, label, Icon }) => {
            const isActive = active === key;
            return (
              <button
                key={key}
                onClick={() => onChange(key)}
                className="tap-haptic flex-1 flex flex-col items-center justify-center gap-1.5 py-3"
                aria-label={label}
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                    isActive ? "glass-volt" : ""
                  )}
                  style={{
                    boxShadow: isActive
                      ? "0 0 18px var(--volt-glow-2)"
                      : undefined,
                  }}
                >
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.5 : 2}
                    style={{
                      color: isActive ? "var(--volt)" : "var(--ink-3)",
                    }}
                  />
                </div>
                <span
                  className="font-cond text-[10px] tracking-wider leading-none uppercase"
                  style={{
                    color: isActive ? "var(--volt)" : "var(--ink-3)",
                    fontWeight: isActive ? 700 : 500,
                  }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
