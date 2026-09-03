/**
 * Reply-language control.
 *
 * Owner: F (with D) · Phase: P4 (replaces the P2 stub)
 *
 * Auto-detect is the default and the top entry, because detecting the language of the
 * query and answering in it is the behaviour the platform is built around — this control
 * is the override, not the primary path.
 *
 * Every language is written in **its own script**. A Tamil speaker scanning a list of
 * English names has to translate before they can choose, which defeats the point of
 * offering their language at all.
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
            ? "Answers come back in whatever language you ask in"
            : `Answers are forced to ${current.english}`
        }
        className="btn-ghost px-2.5 py-1.5"
      >
        <span className="text-[13px] font-semibold">
          {auto ? "Auto" : current.label}
        </span>
        <Icon
          name="chevron"
          size={13}
          className={`text-slate-400 transition-transform duration-200 ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-60 animate-slide-up overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-white/10 dark:bg-abyss-850"
        >
          <button
            type="button"
            role="menuitemradio"
            aria-checked={auto}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
          >
            <Icon
              name="sparkles"
              size={15}
              className="mt-0.5 text-ocean-600 dark:text-ocean-300"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-slate-900 dark:text-slate-100">
                Auto-detect
              </span>
              <span className="block text-[11px] leading-snug muted">
                Ask in any language; the answer comes back in the same one.
              </span>
            </span>
            {auto && (
              <Icon name="check" size={14} className="mt-0.5 text-ocean-600 dark:text-ocean-300" />
            )}
          </button>

          <div className="my-1 h-px bg-slate-200 dark:bg-white/10" />
          <p className="eyebrow px-3 pb-1">Always answer in</p>

          <div className="max-h-64 overflow-y-auto">
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
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <span className="w-24 shrink-0 text-[13px] font-medium text-slate-900 dark:text-slate-100">
                    {language.label}
                  </span>
                  <span className="flex-1 truncate text-[11px] muted">{language.english}</span>
                  {selected && (
                    <Icon name="check" size={14} className="text-ocean-600 dark:text-ocean-300" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
