/**
 * The answer rail — Deep Dive Intelligence Panel for current query.
 */

import ForecastChart from "@/components/conditions/ForecastChart";
import VerdictCard from "@/components/conditions/VerdictCard";
import Icon from "@/components/common/Icon";
import type { OrcaResponse } from "@/types/orca";

interface Props {
  response: OrcaResponse | null;
  isDark: boolean;
  onClose: () => void;
  onOpenSources: () => void;
}

const INTENT_LABEL: Record<string, string> = {
  pfz_lookup: "Potential Fishing Zones",
  safety_check: "Safety & Seaworthiness",
  geofence_check: "Maritime Boundary Proximity",
  diagnostic: "Fish Productivity & Biomass",
  route_planning: "Passage Route Planning",
  general: "Coastal Intelligence",
};

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
    <aside className="flex h-full min-h-0 w-full flex-col border-sky-200/80 bg-white/95 backdrop-blur-md xl:w-[360px] xl:border-l dark:border-cyan-500/15 dark:bg-abyss-900/95 shadow-xl">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-sky-100 px-4 py-3 dark:border-white/10">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
            <h2 className="text-[14px] font-bold leading-tight text-slate-900 dark:text-white">
              Query Intelligence
            </h2>
          </div>
          <p className="truncate text-[10.5px] muted">
            {INTENT_LABEL[response.intent] ?? response.intent}
            {response.location?.name ? ` · ${response.location.name}` : ""}
            {" · "}
            {new Date(response.generated_at).toLocaleTimeString([], {
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
          title="Dismiss panel"
        >
          <Icon name="close" size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5">
        <VerdictCard
          verdict={response.verdict}
          reasons={reasonsFrom(response)}
          usedMockData={response.used_mock_data}
          size="sm"
        />

        {!hasVerdict && (
          <p
            lang={response.language}
            className="rounded-2xl border border-sky-100 bg-sky-50/50 p-3.5 text-[13px] leading-relaxed text-slate-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
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
            className="btn-ghost w-full justify-between py-2.5 hover:border-ocean-400 group"
          >
            <span className="flex items-center gap-2 text-ocean-700 dark:text-cyan-300 font-semibold text-[12px]">
              <Icon name="info" size={15} />
              Inspect {response.evidence.length} Sensor Citations
            </span>
            <Icon
              name="arrow-right"
              size={13}
              className="text-slate-400 group-hover:translate-x-0.5 group-hover:text-ocean-600 dark:group-hover:text-cyan-300 transition-transform"
            />
          </button>
        )}

        {response.attribution.length > 0 && (
          <p className="pt-1 text-[10px] leading-relaxed muted">
            Attribution: {response.attribution.join(" · ")}
          </p>
        )}
      </div>
    </aside>
  );
}
