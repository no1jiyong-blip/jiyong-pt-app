"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface Props {
  size?: number;
  glow?: "none" | "soft" | "strong";
  className?: string;
}

export function BrandLogo({ size = 32, glow = "soft", className }: Props) {
  // 러너 일러스트의 손끝/발끝이 원형 프레임에 딱 붙어 잘려 보이는 문제 —
  // 안쪽에 여유를 두고 object-contain으로 전체가 보이게 함
  const innerSize = Math.round(size * 0.82);
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center shrink-0 overflow-hidden rounded-full",
        glow === "strong" && "brand-logo-glow-strong",
        glow === "soft" && "brand-logo-glow",
        className
      )}
      style={{
        width: size,
        height: size,
        background: "#000",
      }}
    >
      <Image
        src="/logo.png"
        alt="Jiyong PT Pro"
        width={innerSize}
        height={innerSize}
        priority={size >= 80}
        style={{
          width: innerSize,
          height: innerSize,
          objectFit: "contain",
        }}
      />
    </span>
  );
}
