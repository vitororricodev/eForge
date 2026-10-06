import { useEffect, useRef } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import "./evolution-nav.css";

const items = [
  { to: "/reports", label: "Relatórios" },
  { to: "/cardio", label: "Cardio" },
  { to: "/body-profile", label: "Medidas" },
  { to: "/goals", label: "Metas" },
  { to: "/achievements", label: "Medalhas" },
  { to: "/muscle-map", label: "Mapa muscular" },
] as const;

export function EvolutionNav() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scroller.current;
    if (!container) return;

    const revealActive = () => {
      const active = container.querySelector<HTMLAnchorElement>('[aria-current="page"]');
      if (!active) return;
      const bounds = container.getBoundingClientRect();
      const link = active.getBoundingClientRect();
      if (link.left < bounds.left + 6) container.scrollLeft += link.left - bounds.left - 6;
      else if (link.right > bounds.right - 6) container.scrollLeft += link.right - bounds.right + 6;
    };

    revealActive();
    const observer = new ResizeObserver(revealActive);
    observer.observe(container);
    return () => observer.disconnect();
  }, [pathname]);

  if (!items.some((item) => item.to === pathname)) return null;

  return (
    <nav className="eforge-evolution-nav" aria-label="Navegação da Evolução">
      <div className="eforge-evolution-links" ref={scroller}>
        {items.map((item) => (
          <Link key={item.to} to={item.to} aria-current={pathname === item.to ? "page" : undefined}>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
