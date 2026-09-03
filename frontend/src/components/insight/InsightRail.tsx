/**
 * The answer rail — the current answer, in full.
 *
 * Owner: D · Phase: P4
 *
 * The conversation panel keeps a turn glanceable. This is where that turn's verdict,
 * charts and evidence get room to breathe, on the right of the map where the eye lands
 * after reading the answer.
 *
 * It appears only when there is an answer worth the space — a verdict, a chart, or
 * evidence. An empty rail permanently occupying a third of the screen is the fastest way
 * to make a layout feel unfinished.
 */

import ForecastChart from "@/components/conditions/ForecastChart";
import VerdictCard from "@/components/conditions/VerdictCard";
import Icon from "@/components/common/Icon";
import type { OrcaResponse } from "@/types/orca";

interface Props {
  response: OrcaResponse | null;
  isDark: boolean;
  onClose: () => void;
  /** Jump to the Sources view rather than duplicating the whole evidence list here. */
  onOpenSources: () => void;
}

const INTENT_LABEL: Record<string, string> = {
  pfz_lookup: "Fishing zones",
  safety_check: "Safety check",
  geofence_check: "Boundary check",
  diagnostic: "Productivity analysis",
  route_planning: "Route planning",
  general: "General",
};

/**
 * The answer split into sentences, for the verdict card's reason list.
 *
 * The backend's verdict reasons are already in the answer text — the risk agent phrases
 * them into it — so re-listing them from `evidence` would say the same thing twice in two
 * different wordings. Splitting the answer keeps one voice.
 */
function reasonsFrom(response: OrcaResponse): string[] {
  if (!response.verdict || response.verdict === "NOT_APPLICABLE") return [];
  return response.answer
    .split(/(?<=[.;।])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export default function InsightRail({ response, isDark, onClose, onOpenSources }: Props) {
  if (!response) return null;

  const hasVerdict = Boolean(response.verdict && response.verdict !== "NOT_APPLICABLE");
  const hasContent = hasVerdict || response.charts.length > 0 || response.evidence.length > 0;
  if (!hasContent) return null;

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-slate-200 bg-white xl:w-[352px] xl:border-l dark:border-white/10 dark:bg-abyss-900">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-white/10">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold leading-tight text-slate-900 dark:text-white">
            This answer
          </h2>
          <p className="truncate text-[11px] muted">
            {INTENT_LABEL[response.intent] ?? response.intent}
            {response.location?.name ? ` · ${response.location.name}` : ""}
            {" · "}
            {new Date(response.generated_at).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="btn-icon ml-auto"
          aria-label="Hide the answer panel"
          title="Hide"
        >
          <Icon name="close" size={15} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <VerdictCard
          verdict={response.verdict}
          reasons={reasonsFrom(response)}
          usedMockData={response.used_mock_data}
          size="sm"
        />

        {!hasVerdict && (
          <p
            lang={response.language}
            className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
          >
            {response.answer}
          </p>
        )}

        {response.charts.map((chart) => (
          <ForecastChart key={chart.id} spec={chart} isDark={isDark} />
        ))}

        {response.evidence.length > 0 && (
          <button
            type="button"
            onClick={onOpenSources}
            className="btn-ghost w-full justify-between py-2.5"
          >
            <span className="flex items-center gap-2">
              <Icon name="info" size={15} />
              {response.evidence.length} value
              {response.evidence.length === 1 ? "" : "s"} of evidence
            </span>
            <Icon name="arrow-right" size={14} />
          </button>
        )}

        {response.attribution.length > 0 && (
          <p className="pt-1 text-[10.5px] leading-relaxed muted">
            {response.attribution.join(" · ")}
          </p>
        )}
      </div>
    </aside>
  );
}
