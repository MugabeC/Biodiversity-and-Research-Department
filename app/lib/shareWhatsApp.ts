/** Share species info on WhatsApp — user picks any contact (no preset phone number). */

export type WhatsAppShareResult = 'opened' | 'copied' | 'cancelled';

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export async function copySpeciesMessage(message: string): Promise<boolean> {
  return copyToClipboard(message);
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback below */
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Opens WhatsApp with a pre-filled message. The user chooses which contact or group to send to.
 * Uses https://wa.me/ (official click-to-chat) — never whatsapp:// on desktop (breaks without the app).
 */
export async function shareViaWhatsApp(message: string): Promise<WhatsAppShareResult> {
  const encoded = encodeURIComponent(message);
  /** Official link: no phone number → forward / pick a chat */
  const waMeUrl = `https://wa.me/?text=${encoded}`;
  const mobile = isMobileDevice();

  if (mobile && typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: 'Nyandungu Eco-Park — Species',
        text: message,
      });
      return 'opened';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    }
  }

  if (mobile) {
    window.location.href = waMeUrl;
    return 'opened';
  }

  const opened = openInNewTab(waMeUrl);
  if (opened) return 'opened';

  const copied = await copyToClipboard(message);
  return copied ? 'copied' : 'cancelled';
}

function openInNewTab(url: string): boolean {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {
    /* fall through */
  }

  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  return popup != null;
}

/** Plain-text message (no emoji) — avoids garbled characters on some WhatsApp previews. */
export function buildSpeciesWhatsAppMessage(fields: {
  commonName: string;
  scientificName: string;
  kinyarwanda: string;
  taxaLabel: string;
  order: string;
  family: string;
  iucn: string;
  endemismHeadline: string;
  endemismSub: string;
  habitat: string;
  ecologicalRole: string;
  description: string;
}): string {
  const endemism =
    fields.endemismSub && fields.endemismSub !== fields.endemismHeadline
      ? `${fields.endemismHeadline} — ${fields.endemismSub}`
      : fields.endemismHeadline;

  return [
    '*Species Spotted at Nyandungu Eco-Park*',
    `*Common Name:* ${fields.commonName}`,
    `*Scientific Name:* _${fields.scientificName || '—'}_`,
    `*Local Name (Kinyarwanda):* ${fields.kinyarwanda || 'Not yet recorded'}`,
    `*Taxa Group:* ${fields.taxaLabel}`,
    `*Order:* ${fields.order || '—'}`,
    `*Family:* ${fields.family || '—'}`,
    `*IUCN Status:* ${fields.iucn}`,
    `*Endemism:* ${endemism}`,
    `*Habitat:* ${fields.habitat}`,
    `*Ecological Role:* ${fields.ecologicalRole}`,
    `*About:* ${fields.description || 'No description available yet'}`,
    '',
    '_Recorded during the 2025 Biodiversity Survey — Nyandungu Eco-Park, Kigali, Rwanda_',
  ].join('\n');
}
