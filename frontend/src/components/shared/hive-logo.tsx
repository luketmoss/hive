interface HiveLogoProps {
  size?: number;
  class?: string;
}

// The mark is an <img> of the public asset, not inline SVG: it carries a
// document-global <filter id>, and public/ already holds it for the favicon.
// alt="": the sign-in card's <h1> and the board header name it, so this is decorative.
export function HiveLogo({ size = 24, class: className }: HiveLogoProps) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}hive-mark.svg`}
      width={size}
      height={size}
      alt=""
      class={className}
    />
  );
}
