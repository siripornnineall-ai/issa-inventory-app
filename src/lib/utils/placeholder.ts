// สร้างรูปภาพตัวอย่าง (data URI SVG) แบบไม่ต้องพึ่งอินเทอร์เน็ต ใช้สำหรับข้อมูลตัวอย่างเท่านั้น
const PALETTE = [
  ["#0b3f46", "#eafdff"],
  ["#7daab2", "#00282d"],
  ["#d9e2df", "#00282d"],
  ["#f0ebe3", "#40484a"],
  ["#38656c", "#eafdff"],
];

function hashText(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h << 5) - h + text.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function placeholderImage(label: string): string {
  const idx = hashText(label) % PALETTE.length;
  const [bg, fg] = PALETTE[idx];
  const initials = label
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
    <rect width="240" height="240" rx="20" fill="${bg}"/>
    <text x="50%" y="50%" font-family="IBM Plex Sans Thai, sans-serif" font-size="72" font-weight="600" fill="${fg}" text-anchor="middle" dominant-baseline="central">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
