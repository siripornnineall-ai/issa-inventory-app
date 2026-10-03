-- รหัสสั้น 8 ตัวอักษรต่อป้ายหนึ่งใบ สำหรับพิมพ์เป็นบาร์โค้ด (QR ใช้ id แบบ uuid ยาวเหมือนเดิม)
-- ป้ายเก่าไม่มีรหัสนี้ (null) ยังใช้ได้ตามปกติ เก็บเป็นตัวพิมพ์ใหญ่เสมอ และห้ามซ้ำ
alter table public.unit_tokens add column if not exists code text;

create unique index if not exists unit_tokens_code_key on public.unit_tokens (code) where code is not null;

alter table public.unit_tokens drop constraint if exists unit_tokens_code_format;
alter table public.unit_tokens add constraint unit_tokens_code_format check (code is null or code ~ '^[A-HJ-NP-Z2-9]{8}$');
