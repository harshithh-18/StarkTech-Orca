/**
 * Light / dark / system toggle.
 *
 * Owner: D · Phase: P3 · Restyled P4
 *
 * One button cycling three states, labelled by icon and by `title`. Kept small and in the
 * header — it is a convenience, not a feature to show off.
 */

import Icon, { type IconName } from "@/components/common/Icon";
import type { ThemeChoice } from "@/hooks/useTheme";

interface Props {
  choice: ThemeChoice;
  onCycle: () => void;
}

const LABEL: Record<ThemeChoice, { icon: IconName; text: string }> = {
  light: { icon: "sun", text: "Light theme — click for dark" },
  dark: { icon: "moon", text: "Dark theme — click to follow system" },
  system: { icon: "monitor", text: "Following the system theme — click for light" },
};

export default function ThemeToggle({ choice, onCycle }: Props) {
  const { icon, text } = LABEL[choice];

  return (
    <button type="button" onClick={onCycle} title={text} aria-label={text} className="btn-icon">
      <Icon name={icon} size={16} />
    </button>
  );
}
