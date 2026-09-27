/**
 * The location command — working coastal station selector.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import Icon from "@/components/common/Icon";
import { useHarbours } from "@/hooks/useHarbours";
import type { Location } from "@/types/orca";

interface Props {
  value: Location;
  onChange: (location: Location) => void;
  /** The device position, once granted. Null when unavailable or refused. */
  gps: Location | null;
}

const COAST_LABEL: Record<string, string> = {
  east: "East Coast · Bay of Bengal",
  west: "West Coast · Arabian Sea",
};

export default function LocationCommand({ value, onChange, gps }: Props) {
  const harbours = useHarbours();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coastFilter, setCoastFilter] = useState<"all" | "east" | "west">("all");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = gps ? [{ ...gps, name: "My Current Position", state: "GPS", coast: "east" as const }] : [];
    return [
      ...list.filter(() => !needle || "my current position gps device".includes(needle)),
      ...harbours.filter((harbour) => {
        const matchesCoast = coastFilter === "all" || harbour.coast === coastFilter;
        const matchesQuery =
          !needle ||
          harbour.name!.toLowerCase().includes(needle) ||
          harbour.state.toLowerCase().includes(needle);
        return matchesCoast && matchesQuery;
      }),
    ];
  }, [query, coastFilter, gps, harbours]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const choose = (option: (typeof options)[number]) => {
    onChange({
      lat: option.lat,
      lon: option.lon,
      name: option.name,
      source: option.state === "GPS" ? "gps" : "harbour",
    });
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && options[highlight]) {
      event.preventDefault();
      choose(options[highlight]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="group flex max-w-[15rem] items-center gap-2 rounded-xl border border-sky-200/80 bg-sky-50/50 px-2.5 py-1.5 text-left transition-all hover:border-ocean-400 hover:bg-ocean-50/60 sm:max-w-none dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-ocean-400/30 dark:hover:bg-ocean-950/40"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-tr from-ocean-500/15 to-marine-500/20 text-ocean-700 dark:text-cyan-300">
          <Icon name={value.source === "gps" ? "gps" : "harbour"} size={15} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-bold leading-tight text-slate-900 dark:text-slate-100">
            {value.name ?? "Custom Position"}
          </span>
          <span className="block font-mono text-[10px] font-medium leading-tight text-ocean-700 dark:text-ocean-300">
            {value.lat.toFixed(2)}°N {value.lon.toFixed(2)}°E
          </span>
        </span>
        <Icon
          name="chevron"
          size={13}
          className={`ml-1 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-90 text-ocean-600 dark:text-ocean-300" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a coastal base harbour"
          className="absolute left-0 top-[calc(100%+8px)] z-50 w-[21rem] animate-slide-up overflow-hidden rounded-2xl border border-sky-200 bg-white/98 shadow-2xl backdrop-blur-lg dark:border-cyan-500/20 dark:bg-abyss-850/98"
        >
          {/* Search Bar */}
          <div className="flex items-center gap-2 border-b border-sky-100 p-2.5 dark:border-white/10">
            <Icon name="search" size={15} className="text-ocean-600 dark:text-ocean-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlight(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search Indian harbour or state…"
              aria-label="Search harbours"
              className="w-full bg-transparent text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
            />
          </div>

          {/* Coastal Filter Pills */}
          <div className="flex gap-1 border-b border-sky-100 bg-sky-50/50 p-2 dark:border-white/5 dark:bg-abyss-900/50">
            {(
              [
                { id: "all", label: "All Coasts" },
                { id: "east", label: "Bay of Bengal" },
                { id: "west", label: "Arabian Sea" },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setCoastFilter(filter.id)}
                className={`rounded-lg px-2.5 py-1 text-[10.5px] font-bold transition-colors ${
                  coastFilter === filter.id
                    ? "bg-ocean-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-sky-200/50 dark:text-slate-300 dark:hover:bg-white/5"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Results List */}
          <div className="max-h-72 overflow-y-auto py-1">
            {options.length === 0 && (
              <p className="px-3 py-6 text-center text-[12px] muted">
                No coastal port matches “{query}”.
              </p>
            )}

            {options.map((option, index) => {
              const previous = options[index - 1];
              const showHeading =
                option.state !== "GPS" && (!previous || previous.coast !== option.coast);
              const active =
                Math.abs(option.lat - value.lat) < 0.001 &&
                Math.abs(option.lon - value.lon) < 0.001;

              return (
                <div key={`${option.name}-${option.lat}`}>
                  {showHeading && (
                    <p className="eyebrow px-3 pb-1 pt-2.5 text-[10px] text-ocean-700 dark:text-ocean-300">
                      {COAST_LABEL[option.coast]}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => choose(option)}
                    onMouseEnter={() => setHighlight(index)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                      index === highlight
                        ? "bg-ocean-500/10 text-ocean-900 dark:bg-ocean-400/10 dark:text-cyan-200"
                        : "hover:bg-sky-50/70 dark:hover:bg-white/5"
                    }`}
                  >
                    <Icon
                      name={option.state === "GPS" ? "gps" : "harbour"}
                      size={15}
                      className={
                        option.state === "GPS"
                          ? "text-ocean-600 dark:text-cyan-300"
                          : "text-slate-400 dark:text-slate-500"
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold text-slate-900 dark:text-slate-100">
                        {option.name}
                      </span>
                      <span className="block truncate font-mono text-[10px] muted">
                        {option.state} · {option.lat.toFixed(2)}°N, {option.lon.toFixed(2)}°E
                      </span>
                    </span>
                    {active && (
                      <span className="rounded-full bg-marine-500/20 p-1 text-marine-700 dark:text-marine-300">
                        <Icon name="check" size={13} />
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {!gps && (
            <p className="border-t border-sky-100 px-3 py-2 text-[10.5px] muted dark:border-white/10">
              Tip: Allow browser geolocation to anchor your station to your current vessel coordinates.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
