"use client";

import { QRCodeSVG } from "qrcode.react";

export function QrLabel({ value, size = 108, logoUrl }: { value: string; size?: number; logoUrl?: string }) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      level="H"
      marginSize={2}
      imageSettings={logoUrl ? { src: logoUrl, height: size * 0.22, width: size * 0.22, excavate: true } : undefined}
    />
  );
}
