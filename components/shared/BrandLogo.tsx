"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface Props {
  size?: number;
  glow?: "none" | "soft" | "strong";
  className?: string;
}

export function BrandLogo({ size = 32, glow = "soft", className }: Props) {
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
        width={size}
        height={size}
        priority={size >= 80}
        style={{
          width: size,
          height: size,
          objectFit: "cover",
        }}
      />
    </span>
  );
}
