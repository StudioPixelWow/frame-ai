"use client";
import { useState, useEffect, useRef } from "react";

interface AnimatedCounterProps {
  value: number;
  duration?: number; // ms, default 800
  prefix?: string; // e.g. "₪"
  suffix?: string;
  decimals?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function AnimatedCounter({
  value,
  duration = 800,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
  style,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValueRef = useRef(value);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cubic ease-out easing function
  const easeOutCubic = (t: number): number => {
    return 1 - Math.pow(1 - t, 3);
  };

  useEffect(() => {
    // If value hasn't changed, don't animate
    if (value === prevValueRef.current) return;

    const startValue = prevValueRef.current;
    const endValue = value;
    prevValueRef.current = value;

    setIsAnimating(true);

    const animate = (currentTime: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);

      const currentValue =
        startValue + (endValue - startValue) * easedProgress;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete
        setDisplayValue(endValue);
        setIsAnimating(false);
        startTimeRef.current = null;

        // Trigger pop effect by adding/removing class
        if (containerRef.current) {
          containerRef.current.classList.add("ux-counter-animate");
          setTimeout(() => {
            if (containerRef.current) {
              containerRef.current.classList.remove("ux-counter-animate");
            }
          }, 100);
        }
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, duration]);

  const formattedValue = displayValue.toFixed(decimals);

  return (
    <div ref={containerRef} className={className} style={style}>
      {prefix}
      {formattedValue}
      {suffix}
    </div>
  );
}
