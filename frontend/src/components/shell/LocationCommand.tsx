/**
 * The location control — the single most consequential setting in the app.
 *
 * Owner: D · Phase: P4 (replaces the P3 LocationPicker)
 *
 * Everything ORCA says is about a point on the water, so the current point belongs in the
 * header at full size with its name and coordinates visible, not behind a dropdown arrow.
 * It opens a searchable list of harbours grouped by coast, plus the device's own position.
 *
 * Ordinary `<button>`s and a popover rather than a combobox widget: the list is fourteen
 * items, and a roving-tabindex listbox would be more code and more ways to be wrong than
 * arrow-key handling on a filtered list.
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
  east: "East coast · Bay of Bengal",
  west: "West coast · Arabian Sea",
};

export default function LocationCommand({ value, onChange, gps }: Props) {
  const harbours = useHarbours();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = gps ? [{ ...gps, name: "My location", state: "GPS", coast: "east" as const }] : [];
    return [
      ...list.filter(() => !needle || "my location gps".includes(needle)),
      ...harbours.filter(
        (harbour) =>
          !needle ||
          harbour.name!.toLowerCase().includes(needle) ||
          harbour.state.toLowerCase().includes(needle),
      ),
    ];
  }, [query, gps, harbours]);

  // Close on outside click and on Escape.
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
      // Deferred a frame: focusing inside the same tick that mounts the popover races the
      // click that opened it, and the field loses focus immediately.
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
        className="group flex max-w-[15rem] items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 sm:max-w-none dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20 dark:hover:bg-white/[0.08]"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-ocean-500/10 text-ocean-600 dark:bg-ocean-400/10 dark:text-ocean-300">
          <Icon name={value.source === "gps" ? "gps" : "harbour"} size={15} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold leading-tight text-slate-900 dark:text-slate-100">
            {value.name ?? "Custom point"}
          </span>
          <span className="block font-mono text-[10.5px] leading-tight text-slate-500 dark:text-slate-400">
            {value.lat.toFixed(2)}°N {value.lon.toFixed(2)}°E
          </span>
        </span>
        <Icon
          name="chevron"
          size={14}
          className={`ml-auto text-slate-400 transition-transform duration-200 ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a location"
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-[19rem] animate-slide-up overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-abyss-850"
        >
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-white/10">
            <Icon name="search" size={15} className="text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlight(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search harbours…"
              aria-label="Search harbours"
              className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
            />
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {options.length === 0 && (
              <p className="px-3 py-6 text-center text-[13px] muted">
                No harbour matches “{query}”.
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
                    <p className="eyebrow px-3 pb-1 pt-2">{COAST_LABEL[option.coast]}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => choose(option)}
                    onMouseEnter={() => setHighlight(index)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                      index === highlight
                        ? "bg-ocean-500/10 dark:bg-ocean-400/10"
                        : "hover:bg-slate-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <Icon
                      name={option.state === "GPS" ? "gps" : "harbour"}
                      size={15}
                      className={
                        option.state === "GPS"
                          ? "text-ocean-600 dark:text-ocean-300"
                          : "text-slate-400"
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
                        {option.name}
                      </span>
                      <span className="block truncate text-[11px] muted">{option.state}</span>
                    </span>
                    {active && (
                      <Icon
                        name="check"
                        size={14}
                        className="text-ocean-600 dark:text-ocean-300"
                      />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {!gps && (
            <p className="border-t border-slate-200 px-3 py-2 text-[11px] muted dark:border-white/10">
              Allow location access in your browser to fish from where you actually are.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
