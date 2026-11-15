-- ยอดขายอ้างอิงรายเดือน (นำเข้าจากชีตของเจ้าของงาน) ใช้วางแผนผลิตเท่านั้น ไม่แตะสต็อกและไม่ใช่ออเดอร์
-- หนึ่งแถวต่อ (เดือน, รุ่น, สี, ไซซ์) ยอดเป็นจำนวนชิ้นของเดือนนั้น (ถ้าชีตเป็นยอดหลายเดือน ให้หารเป็นต่อเดือนก่อนบันทึก)
create table if not exists public.sales_baseline (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  month date not null,                 -- วันที่ 1 ของเดือนที่ยอดขายนี้เป็นของ
  product_id uuid not null references public.products (id),
  color text not null,
  size text not null,
  qty numeric(12,2) not null check (qty >= 0),
  source_file text,
  imported_by uuid references public.profiles (id),
  imported_by_name text,
  unique (month, product_id, color, size)
);

create index if not exists sales_baseline_month_idx on public.sales_baseline (month desc);

alter table public.sales_baseline enable row level security;

drop policy if exists sales_baseline_all on public.sales_baseline;
create policy sales_baseline_all on public.sales_baseline for all
  using (public.has_perm('report.view'))
  with check (public.has_perm('report.view'));
