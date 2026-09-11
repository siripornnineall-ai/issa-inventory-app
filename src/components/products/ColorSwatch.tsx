const COLOR_HEX_MAP: Record<string, string> = {
  "ดำ": "#1a1a1a",
  "ขาว": "#f5f5f5",
  "ครีม": "#f0e6d2",
  "กรม": "#1e3a5f",
  "เทาดิน": "#8a8477",
  "เทาดำ": "#4b4b4b",
  "เทา": "#9ca3af",
  "น้ำตาลไหม้": "#5c3a21",
  "น้ำตาลใหม่": "#8a5a3c",
  "น้ำตาล": "#7b4a2f",
  "โอวัลติน": "#a97142",
  "ชมพู": "#f4a6c1",
  "กากี": "#9b8759",
  "ฟ้า": "#7ec8e3",
  "น้ำเงิน": "#1e40af",
  "เขียวขี้ม้า": "#6b7a4f",
  "เขียว": "#4a7c59",
  "แดงเลือดหมู": "#7b241c",
  "แดง": "#c0392b",
  "ส้มอิฐ": "#b5541d",
  "ส้ม": "#e08a2f",
  "ม่วง": "#7d5ba6",
  "เหลือง": "#e8c547",
};

export function colorSwatchHex(name: string): string | undefined {
  if (COLOR_HEX_MAP[name]) return COLOR_HEX_MAP[name];
  const key = Object.keys(COLOR_HEX_MAP).find((k) => name.includes(k));
  return key ? COLOR_HEX_MAP[key] : undefined;
}

export function ColorSwatch({ name, imageUrl, size = 40 }: { name: string; imageUrl?: string; size?: number }) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-lg border border-[var(--color-border)] object-cover"
      />
    );
  }
  const hex = colorSwatchHex(name);
  return (
    <div
      style={{ width: size, height: size, backgroundColor: hex }}
      className="flex shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-container)]"
      title={name}
    >
      {!hex && <span className="text-xs font-medium text-[var(--color-on-surface-variant)]">{name.slice(0, 1)}</span>}
    </div>
  );
}
