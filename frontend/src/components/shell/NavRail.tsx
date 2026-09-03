/**
 * Primary navigation.
 *
 * Owner: D · Phase: P4
 *
 * A vertical icon rail on desktop, a bottom tab bar on a phone — one component, because
 * they are the same five destinations and keeping them in one place is what stops the two
 * layouts drifting apart.
 *
 * ## Why the app has views at all
 *
 * The previous build put everything on one screen: chat, map, verdict, charts, trace and
 * citations stacked into a phone viewport. Each part was fine and the whole was
 * unreadable, because nothing told the user what the screen was *for* at any moment.
 * Five named destinations do that:
 *
 *   Ask         the conversation — the primary interaction
 *   Conditions  the now-cast, answered before anyone asks
 *   Alerts      the proactive watch and what it has raised
 *   Layers      the map's own data, explored directly
 *   Sources     provenance, attribution and what ORCA does not know
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
  /**
   * Where this instance sits.
   *
   * Rendered twice — once as the desktop rail inside the content row, once as the mobile
   * bar at the very bottom of the page — because those are two different positions in the
   * document, not one element that moves. Doing it with `order` instead would put the
   * reasoning-trace drawer *below* the tab bar on a phone, which is the one place a
   * thumb-reachable bar must not be.
   */
  variant: "rail" | "bar";
}

const ITEMS: { id: View; label: string; icon: IconName; hint: string }[] = [
  { id: "ask", label: "Ask", icon: "chat", hint: "Ask about the sea in any language" },
  { id: "conditions", label: "Conditions", icon: "gauge", hint: "Live sea, weather and tide" },
  { id: "alerts", label: "Alerts", icon: "bell", hint: "Proactive safety watch" },
  { id: "layers", label: "Layers", icon: "layers", hint: "Explore the map's data layers" },
  { id: "sources", label: "Sources", icon: "info", hint: "Where every number came from" },
];

const BAND_DOT: Record<string, string> = {
  go: "bg-emerald-500",
  caution: "bg-amber-500",
  no_go: "bg-rose-500",
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
      aria-label="Main"
      className={`z-20 flex shrink-0 border-slate-200 bg-white dark:border-white/10 dark:bg-abyss-900 ${
        bar
          ? "h-[56px] w-full border-t md:hidden"
          : "hidden md:flex md:h-full md:w-[68px] md:flex-col md:border-r md:py-3"
      }`}
    >
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
            className={`group relative flex flex-col items-center justify-center gap-1 transition-colors ${
              bar ? "flex-1" : "h-[62px] w-full"
            } ${
              active
                ? "text-ocean-600 dark:text-ocean-300"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            {/* Active marker: a bar along the rail's edge, a bar above the tab on mobile. */}
            <span
              aria-hidden="true"
              className={`absolute bg-ocean-500 transition-opacity duration-200 dark:bg-ocean-400 ${
                bar
                  ? "inset-x-5 top-0 h-0.5 rounded-b-full"
                  : "inset-y-2.5 left-0 w-0.5 rounded-r-full"
              } ${active ? "opacity-100" : "opacity-0"}`}
            />

            <span className="relative">
              <Icon name={item.icon} size={20} />

              {badge > 0 && (
                <span className="absolute -right-2 -top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}

              {dot && (
                <span
                  aria-hidden="true"
                  className={`absolute -right-1.5 -top-1 h-2 w-2 rounded-full ring-2 ring-white dark:ring-abyss-900 ${
                    BAND_DOT[dot] ?? BAND_DOT.none
                  }`}
                />
              )}
            </span>

            <span className="text-[10px] font-semibold leading-none">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
