import Link from "next/link";
import { BrandMark } from "./brand";
import { Rule } from "@/components/ui/card";
import { SITE } from "@/lib/site";

const COLUMNS = [
  {
    title: "Play",
    links: [
      { href: "/", label: "All experiences" },
      { href: "/photobooth", label: "Photobooth" },
      { href: "/play/draw-together", label: "Draw Together" },
      { href: "/play/arcade", label: "Arcade" },
    ],
  },
  {
    title: "Keep",
    links: [
      { href: "/scrapbook", label: "Scrapbook" },
      { href: "/play/letters", label: "Letters" },
      { href: "/play/birthday-gift", label: "Birthday Gift" },
      { href: "/studio", label: "Print Studio" },
    ],
  },
  {
    title: "Yours",
    links: [
      { href: "/hub", label: "Couples Hub" },
      { href: "/profile", label: "Profile" },
      { href: "/about", label: "How it works" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-[120px] sm:mt-[160px]">
      <div className="mx-auto max-w-shell px-gutter">
        <Rule />
        <div className="grid gap-12 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)] lg:gap-10 lg:py-16">
          <div className="max-w-[280px]">
            <div className="flex items-center gap-2.5">
              <BrandMark size={26} />
              <span className="text-[17px] font-extrabold tracking-[-0.04em] text-ink">
                {SITE.name}
              </span>
            </div>
            <p className="t-body-sm mt-4">{SITE.tagline}</p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title}>
              <p className="t-eyebrow mb-5">{column.title}</p>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex text-[14px] font-medium text-ink-muted transition-colors duration-200 hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <Rule />
        <p className="t-caption py-8">
          Built for two people. Everything you keep stays on your device unless you connect a
          backend.
        </p>
      </div>
    </footer>
  );
}
