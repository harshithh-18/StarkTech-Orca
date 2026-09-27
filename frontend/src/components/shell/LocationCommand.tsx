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
        className="group flex max-w-[15rem] items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/[0.06] px-2.5 py-1.5 text-left transition-all hover:border-emerald-500/70 hover:bg-emerald-500/[0.12] sm:max-w-none dark:border-emerald-400/30 dark:bg-emerald-500/[0.08] dark:hover:border-emerald-400/60 dark:hover:bg-emerald-500/[0.15]"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-emerald-500/40 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
          <Icon name={value.source === "gps" ? "gps" : "harbour"} size={15} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-bold leading-tight text-slate-900 dark:text-slate-100">
            {value.name ?? "Custom Position"}
          </span>
          <span className="block font-mono text-[10px] font-medium leading-tight text-emerald-700 dark:text-emerald-400">
            {value.lat.toFixed(2)}°N {value.lon.toFixed(2)}°E
          </span>
        </span>
        <Icon
          name="chevron"
          size={13}
          className={`ml-1 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-90 text-emerald-600 dark:text-emerald-400" : ""
          }`}
        />
      </button>

      {open && (
        <>
          {/* Backdrop clickaway trap to prevent any interaction bleed */}
          <div
            className="fixed inset-0 z-[90]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-label="Choose a coastal base harbour"
            className="absolute left-0 top-[calc(100%+8px)] z-[100] w-[21rem] sm:w-[23rem] animate-slide-up overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-emerald-500/30 dark:bg-[#0c1527] dark:shadow-tactical-elevated"
          >
            {/* Search Bar */}
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/90 p-2.5 dark:border-white/10 dark:bg-[#080e1c]">
              <Icon name="search" size={15} className="text-emerald-600 dark:text-emerald-400" />
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
            <div className="flex gap-1 border-b border-slate-200 bg-slate-100/70 p-2 dark:border-white/5 dark:bg-[#091122]">
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
                      ? "border border-emerald-500/60 bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-white/5"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Results List */}
            <div className="max-h-72 overflow-y-auto py-1 bg-white dark:bg-[#0c1527]">
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
                      <p className="eyebrow px-3 pb-1 pt-2 text-[10px] text-emerald-700 dark:text-emerald-400 bg-slate-50/50 dark:bg-white/[0.02]">
                        {COAST_LABEL[option.coast]}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => choose(option)}
                      onMouseEnter={() => setHighlight(index)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                        index === highlight
                          ? "border-l-2 border-emerald-500 bg-emerald-50/70 text-slate-900 dark:bg-emerald-500/15 dark:text-white"
                          : "hover:bg-slate-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <Icon
                        name={option.state === "GPS" ? "gps" : "harbour"}
                        size={15}
                        className={
                          option.state === "GPS"
                            ? "text-ocean-600 dark:text-ocean-400"
                            : "text-slate-400 dark:text-slate-400"
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
                        <span className="rounded-full bg-emerald-500/20 p-1 text-emerald-700 dark:text-emerald-400">
                          <Icon name="check" size={13} />
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {!gps && (
              <p className="border-t border-slate-200 bg-slate-50/80 px-3 py-2 text-[10.5px] muted dark:border-white/10 dark:bg-[#080e1c]">
                Tip: Allow browser geolocation to anchor your station to your current vessel coordinates.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
