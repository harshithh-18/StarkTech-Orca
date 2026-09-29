/**
 * Primary maritime navigation — Vertical Station Rail on desktop, Thumb Dock on mobile.
 */

import Icon, { type IconName } from "@/components/common/Icon";

export type View = "ask" | "conditions" | "alerts" | "layers" | "sources";

interface Props {
  view: View;
  onChange: (view: View) => void;
  /** Unread proactive alerts. Rendered as a count badge on the Alerts tab. */
  alertCount?: number;
  /** Shown on the Conditions tab so the verdict is visible from anywhere in the app. */
  conditionBand?: "none" | "go" | "caution" | "no_go";
  variant: "rail" | "bar";
}

const ITEMS: { id: View; label: string; icon: IconName; hint: string }[] = [
  { id: "ask", label: "Console", icon: "chat", hint: "Maritime intelligence query & agent reasoning" },
  { id: "conditions", label: "Conditions", icon: "gauge", hint: "Live sea state, wave heights & tides" },
  { id: "alerts", label: "Watch", icon: "radar", hint: "Proactive automated coastal hazard watch" },
  { id: "layers", label: "Charts", icon: "layers", hint: "Explore bathymetry, zones, fronts & boundaries" },
  { id: "sources", label: "Provenance", icon: "info", hint: "Sensor data evidence & computational proxies" },
];

const BAND_DOT: Record<string, string> = {
  go: "bg-emerald-500 shadow-sm shadow-emerald-500/50",
  caution: "bg-amber-500 shadow-sm shadow-amber-500/50",
  no_go: "bg-rose-500 shadow-sm shadow-rose-500/50",
  none: "bg-slate-400",
};

export default function NavRail({
  view,
  onChange,
  alertCount = 0,
  conditionBand,
  variant,
}: Props) {
  const bar = variant === "bar";

  return (
    <nav
      aria-label="Main Navigation"
      className={`z-20 flex shrink-0 border-slate-200/80 bg-white/85 backdrop-blur-2xl dark:border-emerald-500/20 dark:bg-[#030914]/85 ${
        bar
          ? "h-[58px] w-full border-t md:hidden"
          : "hidden md:flex md:h-full md:w-[72px] md:flex-col md:border-r md:py-3.5 shadow-sm"
      }`}
    >
      <div className={`flex ${bar ? "w-full flex-row" : "w-full flex-col gap-1.5"}`}>
        {ITEMS.map((item) => {
          const active = view === item.id;
          const badge = item.id === "alerts" ? alertCount : 0;
          const dot = item.id === "conditions" ? conditionBand : undefined;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              aria-current={active ? "page" : undefined}
              title={item.hint}
              className={`group relative flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
                bar ? "flex-1 py-1" : "h-[64px] w-full px-2"
              } ${
                active
                  ? "text-ocean-600 dark:text-ocean-400 font-bold"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              {/* Active ambient glow tile */}
              {active && (
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 dark:border-emerald-400/20 dark:bg-emerald-500/15 ${
                    bar ? "inset-y-1" : "inset-y-1.5"
                  }`}
                />
              )}

              {/* Edge marker pill */}
              <span
                aria-hidden="true"
                className={`absolute bg-emerald-500 dark:bg-emerald-400 transition-all duration-200 ${
                  bar
                    ? "inset-x-6 top-0 h-0.5 rounded-b-full shadow-sm shadow-emerald-500/50"
                    : "inset-y-3 left-0 w-1 rounded-r-full shadow-sm shadow-emerald-500/50"
                } ${active ? "opacity-100" : "opacity-0"}`}
              />

              <span className="relative z-10">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-lg transition-transform group-hover:scale-105 ${
                    active
                      ? "border border-emerald-400/50 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30"
                      : "group-hover:bg-slate-100 dark:group-hover:bg-white/[0.06]"
                  }`}
                >
                  <Icon name={item.icon} size={18} />
                </span>

                {badge > 0 && (
                  <span className="absolute -right-1.5 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[9.5px] font-black leading-none text-white shadow-sm animate-pulse">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}

                {dot && (
                  <span
                    aria-hidden="true"
                    className={`absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-abyss-900 ${
                      BAND_DOT[dot] ?? BAND_DOT.none
                    }`}
                  />
                )}
              </span>

              <span
                className={`relative z-10 text-[10.5px] font-bold tracking-tight leading-none ${
                  active ? "text-emerald-700 dark:text-emerald-300" : ""
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
