// โหลดรูปให้เสร็จก่อนค่อยสั่งพิมพ์ — กันโลโก้แบรนด์กลาง QR หายตอนพิมพ์ เพราะรูปยังโหลดจากเน็ตไม่ทันตอน window.print() ทำงาน
export function preloadImages(urls: (string | undefined)[]): Promise<void> {
  const unique = Array.from(new Set(urls.filter((u): u is string => Boolean(u))));
  if (unique.length === 0) return Promise.resolve();
  return Promise.all(
    unique.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        })
    )
  ).then(() => undefined);
}
