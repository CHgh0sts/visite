/**
 * Teinte krpano des hotspots image (`colorize`) — format doc : 0xRRGGBB.
 * @see https://krpano.com/docu/xml/#hotspot
 */

export function krpanoColorizeToPickerHex(raw: string | undefined): string {
  const t = raw?.trim() ?? "";
  if (/^0x[0-9A-Fa-f]{6}$/i.test(t)) return `#${t.slice(2).toLowerCase()}`;
  if (/^#[0-9A-Fa-f]{6}$/i.test(t)) return `#${t.slice(1).toLowerCase()}`;
  return "#ffffff";
}

export function pickerHexToKrpanoColorize(input: string): string {
  const t = input.trim();
  if (/^#[0-9A-Fa-f]{6}$/i.test(t)) return `0x${t.slice(1).toLowerCase()}`;
  if (/^0x[0-9A-Fa-f]{6}$/i.test(t)) return t.toLowerCase();
  return "0xffffff";
}
