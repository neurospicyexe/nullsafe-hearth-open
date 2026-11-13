"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { shellHidden } from "@/lib/shell";
import { SEARCH_EVENT, searchDetail } from "@/lib/search-handoff";
import Header from "./Header";
import TabBar from "./TabBar";
import InnerNav from "./InnerNav";
import GreetingTitle from "../home/GreetingTitle";

const SearchOverlay = dynamic(() => import("../SearchOverlay"), { ssr: false });

/**
 * Header, page (with its inner-page header where it has one), tab bar. The check-in lives on Home.
 * The reader and login render bare, with no chrome.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [searchOpen, setSearchOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState("");
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const hidden = shellHidden(pathname);

  useEffect(() => {
    if (hidden) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setInitialQuery("");
        setSearchOpen((o) => !o);
      }
    };
    const onSearch = (e: Event) => {
      setInitialQuery(searchDetail(e));
      setSearchOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(SEARCH_EVENT, onSearch);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(SEARCH_EVENT, onSearch);
    };
  }, [hidden]);

  if (hidden) return <main className="app-main">{children}</main>;

  return (
    <div className="h-shell">
      <Header onSearch={() => { setInitialQuery(""); setSearchOpen(true); }}>{pathname === "/" ? <GreetingTitle /> : undefined}</Header>
      <main className="app-main h-main">
        <InnerNav />
        {children}
      </main>
      <TabBar />
      <SearchOverlay open={searchOpen} onClose={closeSearch} initialQuery={initialQuery} />
    </div>
  );
}
