interface HiveLogoProps {
  size?: number;
  class?: string;
}

export function HiveLogo({ size = 24, class: className }: HiveLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      width={size}
      height={size}
      class={className}
    >
      <polygon points="12 2 21 7 21 17 12 22 3 17 3 7" fill="var(--color-accent)" />
      <path
        d="M7 12.5l3.2 3.2L17 9.5"
        fill="none"
        stroke="white"
        stroke-width="2.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
