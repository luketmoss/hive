import { labels as labelsStore } from '../../state/board-store';

interface Props {
  label: string;
}

export function LabelBadge({ label }: Props) {
  const labelDef = labelsStore.value.find(l => l.label === label);
  const color = labelDef?.color || '#999';

  return (
    <span class="label-badge" style={{ backgroundColor: color }}>
      {label}
    </span>
  );
}
