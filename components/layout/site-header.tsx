"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLockup } from "./brand";
import { Button } from "@/components/ui/button";
import { JoinRoomDialog } from "@/components/room/join-room-dialog";
import { getIdentity } from "@/lib/rooms/identity";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Experiences" },
  { href: "/photobooth", label: "Photobooth" },
  { href: "/scrapbook", label: "Scrapbook" },
  { href: "/hub", label: "Hub" },
];

/**
 * Minimal by design: mark, one row of links, one action, one avatar. It goes
 * translucent only once the page has scrolled, so the top of every page reads
 * as one uninterrupted surface.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [joinOpen, setJoinOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [avatar, setAvatar] = useState<{ emoji: string; name: string } | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const read = () => {
      const id = getIdentity();
      setAvatar({ emoji: id.emoji, name: id.name });
    };
    read();
    window.addEventListener("together:identity", read);
    return () => window.removeEventListener("together:identity", read);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300",
          scrolled
            ? "border-b border-line bg-canvas/80 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto flex h-[76px] max-w-shell items-center gap-4 px-gutter">
          <BrandLockup />

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative rounded-pill px-3.5 py-2 text-[14px] font-semibold tracking-[-0.012em] transition-colors duration-200",
                    active ? "text-ink" : "text-ink-muted hover:text-ink",
                  )}
                >
                  {item.label}
                  {active && (
                    <span
                      className="absolute inset-x-3.5 -bottom-0.5 h-[2px] rounded-pill bg-ink"
                      aria-hidden="true"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-6">
            <Button variant="secondary" size="sm" onClick={() => setJoinOpen(true)}>
              Join a room
            </Button>

            <Link
              href="/profile"
              aria-label="Your profile"
              className="group/avatar hidden h-10 w-10 place-items-center rounded-pill bg-surface text-[16px] ring-1 ring-inset ring-line transition-all duration-200 hover:-translate-y-[1px] hover:shadow-sm hover:ring-line-strong sm:grid"
            >
              <span className="transition-transform duration-[420ms] ease-spring group-hover/avatar:scale-110">
                {avatar?.emoji ?? "·"}
              </span>
            </Link>

            <button
              type="button"
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-pill text-ink md:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                {menuOpen ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M4 8h16M4 16h16" />}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="a-fade border-t border-line bg-surface px-gutter py-3 md:hidden">
            {[...NAV, { href: "/profile", label: "Profile" }].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-sm px-3 py-3 text-[16px] font-semibold tracking-[-0.02em] text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      <JoinRoomDialog open={joinOpen} onClose={() => setJoinOpen(false)} />
    </>
  );
}
