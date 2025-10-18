import React, { useEffect, useMemo, useState } from "react";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "full" | "symbol" | "wordmark";
  className?: string;
}

const WORD = "ReconEasy";

export default function Logo({ size = "md", variant = "full", className = "" }: LogoProps) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setAnimated(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const iconSizeClasses: Record<Required<LogoProps>["size"], string> = {
    sm: "h-6 w-6",
    md: "h-7 w-7",
    lg: "h-10 w-10",
    xl: "h-12 w-12",
  };

  const wordSizeClasses: Record<Required<LogoProps>["size"], string> = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
    xl: "text-[28px]",
  };

  const letters = useMemo(() => WORD.split(""), []);

  const LogoSymbol = () => (
    <div
      className={`logo-icon-container ${iconSizeClasses[size]}`}
      style={{ animationDelay: "0.12s" }}
    >
      <img
        src="/reconeasy-logo.png"
        alt="ReconEasy logo mark"
        className="logo-icon object-contain"
      />
    </div>
  );

  const LogoWordmark = () => (
    <div
      className={`logo-wordmark font-semibold tracking-tight ${wordSizeClasses[size]}`}
    >
      {letters.map((letter, index) => {
        const isTeal = index < 5;
        return (
          <span
            key={`${letter}-${index}`}
            className={`logo-letter ${isTeal ? "text-teal-500 dark:text-teal-300" : "text-orange-500"}`}
            style={{ animationDelay: `${0.38 + index * 0.09}s` }}
          >
            {letter}
          </span>
        );
      })}
    </div>
  );

  return (
    <div
      className={`logo-brand flex items-center gap-2 ${animated ? "logo-animated" : ""} ${className}`}
      data-size={size}
    >
      {(variant === "full" || variant === "symbol") && <LogoSymbol />}
      {(variant === "full" || variant === "wordmark") && <LogoWordmark />}
    </div>
  );
}
