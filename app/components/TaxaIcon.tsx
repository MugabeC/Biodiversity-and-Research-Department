/** Taxa icons from public/images — thin line SVGs, tinted via theme color. */

const TAXA_KEY_FROM_LABEL: Record<string, string> = {
  Birds: 'birds',
  Plants: 'plants',
  Butterflies: 'butterflies',
  'Aquatic Inverts': 'aquatic_inverts',
  'Amphibians & Reptiles': 'amphibians-reptiles',
  Mammals: 'mammals',
  Fish: 'fish',
};

/** Filename under public/images (must match files on disk). */
const TAXA_ICON_FILES: Record<string, string> = {
  birds: 'icon-bird.svg',
  plants: 'icon-plant.svg',
  butterflies: 'icon-butterfly.svg',
  aquatic_inverts: 'icon-aquatic Invert.svg',
  'amphibians-reptiles': 'icon-amphibian.svg',
  mammals: 'icon-mammal.svg',
  fish: 'icon-fish.svg',
};

const TAXA_EMOJI: Record<string, string> = {
  birds: '🐦',
  plants: '🌿',
  butterflies: '🦋',
  aquatic_inverts: '🦐',
  'amphibians-reptiles': '🐸',
  mammals: '🐾',
  fish: '🐟',
};

function resolveTaxaKey(taxa: string): string {
  return TAXA_KEY_FROM_LABEL[taxa] ?? taxa;
}

export function taxaIconSrc(key: string): string | undefined {
  const file = TAXA_ICON_FILES[key];
  if (!file) return undefined;
  return `/images/${encodeURIComponent(file)}`;
}

export default function TaxaIcon({
  taxa,
  size = 64,
  opacity = 1,
  className,
}: {
  taxa: string;
  size?: number;
  opacity?: number;
  className?: string;
}) {
  const key = resolveTaxaKey(taxa);
  const src = taxaIconSrc(key);

  if (!src) {
    return (
      <span
        role="img"
        aria-hidden
        className={className}
        style={{ fontSize: size, lineHeight: 1, opacity, color: 'var(--meadow-green)' }}
      >
        🌱
      </span>
    );
  }

  return (
    <span
      className={`taxa-line-icon${className ? ` ${className}` : ''}`}
      style={{
        width: size,
        height: size,
        opacity,
        WebkitMaskImage: `url("${src}")`,
        maskImage: `url("${src}")`,
      }}
      role="img"
      aria-hidden
    />
  );
}

export { TAXA_EMOJI, resolveTaxaKey };
