"use client";

import { useEffect, useState } from "react";

interface Piece {
  id: number;
  left: number;
  delay: number;
  color: string;
  rotate: number;
}

const VOLT_PALETTE = [
  "#D3FF52",
  "#E5FF6E",
  "#a8cc3e",
  "#FFFFFF",
  "#4488ff",
];

interface Props {
  /** 트리거 키 — 값이 바뀌면 confetti 발사 */
  trigger: number;
  /** 발사 개수 */
  count?: number;
}

export function Confetti({ trigger, count = 60 }: Props) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (trigger === 0) return;

    const arr: Piece[] = Array.from({ length: count }, (_, i) => ({
      id: trigger * 1000 + i,
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      color: VOLT_PALETTE[Math.floor(Math.random() * VOLT_PALETTE.length)],
      rotate: Math.random() * 360,
    }));
    setPieces(arr);

    const t = setTimeout(() => setPieces([]), 2200);
    return () => clearTimeout(t);
  }, [trigger, count]);

  if (pieces.length === 0) return null;

  return (
    <>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            top: "-20px",
            backgroundColor: p.color,
            borderRadius: 2,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotate}deg)`,
            boxShadow: `0 0 8px ${p.color}80`,
          }}
        />
      ))}
    </>
  );
}
