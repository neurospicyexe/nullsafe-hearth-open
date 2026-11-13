"use client";

import { useState, type FormEvent } from "react";
import { openSearch } from "@/lib/search-handoff";

export default function ArchiveSearch() {
  const [q, setQ] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    openSearch(v);
  };
  return (
    <form className="h-archive-search" onSubmit={submit} role="search">
      <div className="h-archive-search-row">
        <input
          name="q"
          maxLength={100}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search the cellar"
          placeholder="Search the cellar"
          autoComplete="off"
        />
        <button type="submit">Search</button>
      </div>
      <p className="h-archive-search-note">Searches recent items: the newest 50 of each kind.</p>
    </form>
  );
}
