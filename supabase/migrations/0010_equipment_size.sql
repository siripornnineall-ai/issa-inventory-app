-- ไซซ์ของอุปกรณ์ (ไม่บังคับ) เช่น เลเบิ้ลไซซ์ S/M/L หรือถุงขนาดต่าง ๆ แต่ละไซซ์แยกเป็นอุปกรณ์คนละรายการเพื่อให้มีสต็อกของตัวเอง
alter table public.equipment add column if not exists size text;
