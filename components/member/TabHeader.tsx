"use client";

interface Props {
  title: string;
  subtitle: string;
}

/**
 * 모든 탭 상단의 통일된 헤더.
 * - 영문 대문자 메인 타이틀 (Bebas Neue Italic, 강렬한 크기)
 * - 회색 한글 부제 (감성)
 * - 자간 좁게(tight)로 컴팩트한 하이엔드 감성
 */
export function TabHeader({ title, subtitle }: Props) {
  return (
    <header className="flex flex-col gap-2 px-1">
      <h1
        className="font-italic-display uppercase text-ink-0"
        style={{
          fontSize: "clamp(32px, 8.5vw, 44px)",
          letterSpacing: "-0.03em",
          textShadow: "0 0 14px rgba(255,255,255,0.05)",
          lineHeight: 0.92,
        }}
      >
        {title}
      </h1>
      <p
        className="font-cond text-ink-3 leading-none"
        style={{
          fontSize: 12,
          letterSpacing: "0.015em",
        }}
      >
        {subtitle}
      </p>
    </header>
  );
}
