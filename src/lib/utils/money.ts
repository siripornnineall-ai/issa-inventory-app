// จัดการเงินบาทแบบแม่นยำโดยแปลงเป็นสตางค์ (จำนวนเต็ม) ก่อนคำนวณ เพื่อไม่ให้ทศนิยมคลาดเคลื่อน

export function toSatang(baht: number): number {
  return Math.round(baht * 100);
}

export function fromSatang(satang: number): number {
  return satang / 100;
}

export function sumBaht(values: number[]): number {
  return fromSatang(values.reduce((sum, v) => sum + toSatang(v), 0));
}

export function formatTHB(baht: number, opts?: { compact?: boolean }): string {
  if (opts?.compact && Math.abs(baht) >= 1_000_000) {
    return `฿${(baht / 1_000_000).toFixed(1)}M`;
  }
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    currencyDisplay: "symbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(baht);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("th-TH").format(n);
}

export const VAT_RATE = 0.07;

// ราคาที่กรอกในระบบถือเป็นราคารวม VAT แล้ว (แบบเดียวกับใบกำกับภาษีจริงที่ใช้อยู่)
// จึงคำนวณย้อนกลับ: ราคาไม่รวมภาษี = ราคารวม / 1.07, VAT = ราคารวม - ราคาไม่รวมภาษี
export function vatBreakdown(grandTotal: number, vatEnabled: boolean): { subtotal: number; vat: number; grandTotal: number } {
  if (!vatEnabled) return { subtotal: grandTotal, vat: 0, grandTotal };
  const subtotal = fromSatang(Math.round(toSatang(grandTotal) / (1 + VAT_RATE)));
  const vat = fromSatang(toSatang(grandTotal) - toSatang(subtotal));
  return { subtotal, vat, grandTotal };
}

export function profitPerUnit(sellingPrice: number, purchasePrice: number): number {
  return fromSatang(toSatang(sellingPrice) - toSatang(purchasePrice));
}

export function profitPercent(sellingPrice: number, purchasePrice: number): number {
  if (sellingPrice <= 0) return 0;
  const profit = profitPerUnit(sellingPrice, purchasePrice);
  return Math.round((profit / sellingPrice) * 10000) / 100;
}
