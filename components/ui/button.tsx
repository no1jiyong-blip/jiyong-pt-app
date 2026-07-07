"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "volt" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "volt", size = "md", ...props }, ref) => {
    const base = variant === "volt" ? "btn-volt" : "btn-ghost";
    const sizeStyle =
      size === "sm"
        ? { minHeight: 40, padding: "8px 16px", fontSize: 13 }
        : size === "lg"
        ? { minHeight: 56, padding: "16px 24px", fontSize: 16 }
        : {};

    return (
      <button
        ref={ref}
        className={cn(base, className)}
        style={sizeStyle}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
