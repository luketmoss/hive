import { useEffect, useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { boardStatuses } from '../../state/board-store';

export function ColumnIndicator() {
  const activeIndex = useSignal(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const main = document.querySelector('.board-main') as HTMLElement | null;
    if (!main) return;

    const onScroll = () => {
      const idx = Math.round(main.scrollLeft / main.clientWidth);
      activeIndex.value = Math.max(0, Math.min(idx, boardStatuses.value.length - 1));
    };

    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (idx: number) => {
    const main = document.querySelector('.board-main') as HTMLElement | null;
    if (!main) return;
    main.scrollTo({ left: idx * main.clientWidth, behavior: 'smooth' });
  };

  const cols = boardStatuses.value;
  if (cols.length === 0) return null;

  return (
    <div class="column-indicator" ref={containerRef}>
      <span class="column-indicator-label">{cols[activeIndex.value]?.name}</span>
      {cols.map((col, i) => (
        <button
          key={col.name}
          class={`column-indicator-dot${i === activeIndex.value ? ' active' : ''}`}
          onClick={() => scrollTo(i)}
          aria-label={`Go to ${col.name}`}
        />
      ))}
    </div>
  );
}
