/**
 * Opens the server-generated .vcf so the phone's Contacts app takes over.
 *
 * iOS: navigate to the real https URL. Safari then shows the native
 * contact card with "Create New Contact" — which actually saves. (Blob:
 * and data: URLs open a Quick Look preview instead, whose ✓ just closes
 * it, so nothing gets saved — that was the bug.)
 *
 * Android / desktop: a normal download; Android then offers to import it.
 */
export function saveContactFromUrl(url: string, fileName = "contact.vcf") {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isIOS) {
    window.location.href = url;
    return;
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 100);
}
