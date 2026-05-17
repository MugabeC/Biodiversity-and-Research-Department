/** Open WhatsApp so the user can choose any contact (no preset phone number). */

export function shareViaWhatsApp(message: string): void {
  const encoded = encodeURIComponent(message);
  const apiUrl = `https://api.whatsapp.com/send?text=${encoded}`;
  const webUrl = `https://web.whatsapp.com/send?text=${encoded}`;
  const appUrl = `whatsapp://send?text=${encoded}`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    navigator
      .share({ title: 'Nyandungu Eco-Park — Species', text: message })
      .catch(() => {
        openWhatsAppUrl(apiUrl, appUrl, webUrl);
      });
    return;
  }

  openWhatsAppUrl(apiUrl, appUrl, webUrl);
}

function openWhatsAppUrl(apiUrl: string, appUrl: string, webUrl: string): void {
  const isMobile = typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  if (isMobile) {
    window.location.href = appUrl;
    return;
  }

  const opened = window.open(apiUrl, '_blank', 'noopener,noreferrer');
  if (!opened) window.location.href = webUrl;
}
