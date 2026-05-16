/** Lightweight taxa icons — no image files required. */

const TAXA_EMOJI: Record<string, string> = {
  birds: '🐦',
  plants: '🌿',
  butterflies: '🦋',
  aquatic_inverts: '🦐',
  'amphibians-reptiles': '🐸',
  mammals: '🐾',
  fish: '🐟',
};

const TAXA_KEY_FROM_LABEL: Record<string, string> = {
  Birds: 'birds',
  Plants: 'plants',
  Butterflies: 'butterflies',
  'Aquatic Inverts': 'aquatic_inverts',
  'Amphibians & Reptiles': 'amphibians-reptiles',
  Mammals: 'mammals',
  Fish: 'fish',
};

function resolveTaxaKey(taxa: string): string {
  return TAXA_KEY_FROM_LABEL[taxa] ?? taxa;
}

export default function TaxaIcon({
  taxa,
  size = 64,
  opacity = 1,
}: {
  taxa: string;
  size?: number;
  opacity?: number;
}) {
  const key = resolveTaxaKey(taxa);
  const emoji = TAXA_EMOJI[key] ?? '🌱';

  return (
    <span
      role="img"
      aria-hidden
      style={{
        fontSize: size,
        lineHeight: 1,
        opacity,
        display: 'inline-block',
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.12))',
        userSelect: 'none',
      }}
    >
      {emoji}
    </span>
  );
}

export { TAXA_EMOJI, resolveTaxaKey };
