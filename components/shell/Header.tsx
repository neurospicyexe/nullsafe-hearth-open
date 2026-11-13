"use client";

import type { ReactNode } from "react";

/** Title slot on the left, search button on the right. */
export default function Header({ children, onSearch }: { children?: ReactNode; onSearch: () => void }) {
  return (
    <header className="h-header">
      <div className="h-header-title">{children ?? "Hearth"}</div>
      <button type="button" className="h-search-btn" onClick={onSearch} aria-label="Search everything" title="Search (Ctrl+K)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      </button>
    </header>
  );
}
