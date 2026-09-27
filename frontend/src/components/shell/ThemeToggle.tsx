/**
 * Maritime theme switch: Daylight Coastal / Abyssal Night / Ship System.
 */

import Icon, { type IconName } from "@/components/common/Icon";
import type { ThemeChoice } from "@/hooks/useTheme";

interface Props {
  choice: ThemeChoice;
  onCycle: () => void;
}

const LABEL: Record<ThemeChoice, { icon: IconName; text: string }> = {
  light: { icon: "sun", text: "Coastal daylight mode — click for abyssal dark" },
  dark: { icon: "moon", text: "Abyssal night mode — click to follow vessel system" },
  system: { icon: "monitor", text: "Following system theme — click for daylight" },
};

export default function ThemeToggle({ choice, onCycle }: Props) {
  const { icon, text } = LABEL[choice];

  return (
    <button
      type="button"
      onClick={onCycle}
      title={text}
      aria-label={text}
      className="btn-icon hover:text-ocean-600 dark:hover:text-cyan-300 transition-colors"
    >
      <Icon name={icon} size={16} />
    </button>
  );
}
