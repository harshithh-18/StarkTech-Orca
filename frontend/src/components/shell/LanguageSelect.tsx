/**
 * Reply-language control — Indian Coastal Languages & Auto-Detect.
 */

import { useEffect, useRef, useState } from "react";

import Icon from "@/components/common/Icon";
import { LANGUAGES } from "@/hooks/useProfile";
import type { Language } from "@/types/orca";

interface Props {
  value: Language;
  auto?: boolean;
  onChange: (language: Language | null) => void;
}

export default function LanguageSelect({ value, auto = false, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const current = LANGUAGES.find((language) => language.code === value) ?? LANGUAGES[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={
          auto
            ? "Auto-Detect: Answers match whatever language you ask in"
            : `Answers are pinned to ${current.english}`
        }
        className="btn-ghost px-2.5 py-1.5 flex items-center gap-1.5"
      >
        <span className="text-[12px] font-bold text-ocean-700 dark:text-cyan-300">
          {auto ? "Auto" : current.label}
        </span>
        <Icon
          name="chevron"
          size={12}
          className={`text-slate-400 transition-transform duration-200 ${
            open ? "rotate-90 text-ocean-600 dark:text-cyan-300" : ""
          }`}
        />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[90]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className="absolute right-0 top-[calc(100%+8px)] z-[100] w-64 animate-slide-up overflow-hidden rounded-2xl border border-slate-200 bg-white py-1.5 shadow-2xl dark:border-blue-500/30 dark:bg-[#0c1527] dark:shadow-tactical-elevated"
          >
            {/* Auto-detect button */}
            <button
              type="button"
              role="menuitemradio"
              aria-checked={auto}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={`flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors ${
                auto
                  ? "bg-ocean-50 text-ocean-900 dark:bg-ocean-500/20 dark:text-white"
                  : "hover:bg-slate-50 dark:hover:bg-white/5"
              }`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ocean-500/15 text-ocean-600 dark:text-ocean-400">
                <Icon name="sparkles" size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-bold text-slate-900 dark:text-slate-100">
                  Auto-Detect Language
                </span>
                <span className="block text-[10.5px] leading-snug muted">
                  Detects input script & answers in the same Indic tongue.
                </span>
              </span>
              {auto && (
                <span className="rounded-full bg-emerald-500/20 p-0.5 text-emerald-700 dark:text-emerald-400">
                  <Icon name="check" size={13} />
                </span>
              )}
            </button>

            <div className="my-1.5 h-px bg-slate-100 dark:bg-white/10" />
            <p className="eyebrow px-3 pb-1 text-[10px] text-ocean-700 dark:text-ocean-300">
              Pin Reply Language
            </p>

            <div className="max-h-64 overflow-y-auto py-0.5 bg-white dark:bg-[#0c1527]">
              {LANGUAGES.map((language) => {
                const selected = !auto && language.code === value;
                return (
                  <button
                    key={language.code}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => {
                      onChange(language.code);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
                      selected
                        ? "bg-ocean-50 text-ocean-900 dark:bg-ocean-500/20 dark:text-white font-bold"
                        : "hover:bg-slate-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <span className="w-24 shrink-0 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                      {language.label}
                    </span>
                    <span className="flex-1 truncate text-[11px] muted">{language.english}</span>
                    {selected && (
                      <span className="rounded-full bg-emerald-500/20 p-0.5 text-emerald-700 dark:text-emerald-400">
                        <Icon name="check" size={13} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
