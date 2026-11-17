"use client";

import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

/** Filtros recolhidos no celular (botão "Filtros") e sempre visíveis no computador. */
export function FiltersToggle({ children, label = "Filtros" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="btn btn-outline mb-2 w-full justify-between lg:hidden"
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="size-4" /> {label}
        </span>
        <ChevronDown className={clsx("size-4 transition-transform", open && "rotate-180")} />
      </button>
      <div className={clsx(!open && "hidden", "lg:block")}>{children}</div>
    </div>
  );
}
