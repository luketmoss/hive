import { labels as labelsStore } from '../../state/board-store';
import { getContrastTextColor } from '../../utils/color';

interface Props {
  label: string;
}

export function LabelBadge({ label }: Props) {
  const labelDef = labelsStore.value.find(l => l.label === label);
  const color = labelDef?.color || '#999';
  const textColor = getContrastTextColor(color);

  return (
    <span class="label-badge" style={{ backgroundColor: color, color: textColor }}>
      {label}
    </span>
  );
}
