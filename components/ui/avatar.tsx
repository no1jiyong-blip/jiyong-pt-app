"use client";

import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  size?: number;
  active?: boolean;
  className?: string;
}

export function Avatar({ name, size = 48, active = false, className }: AvatarProps) {
  return (
    <div
      className={cn("rounded-full flex items-center justify-center font-display shrink-0", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        backgroundColor: active ? "var(--volt)" : "var(--pt-4)",
        color: active ? "#000" : "var(--ink-1)",
        lineHeight: 1,
      }}
    >
      {name.charAt(0)}
    </div>
  );
}
