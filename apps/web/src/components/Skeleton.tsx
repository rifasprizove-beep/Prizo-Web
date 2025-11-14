import React from "react";

export function Skeleton({ className = "", style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span
      className={`inline-block animate-pulse bg-gray-300/40 rounded ${className}`}
      style={{ minWidth: 40, minHeight: 16, ...style }}
      aria-busy="true"
    />
  );
}
