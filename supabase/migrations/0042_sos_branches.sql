-- สาขาหน้าร้าน SOS (ฝากขายที่ SOS Sense Of Style): เก็บข้อมูลที่นำเข้าจากไฟล์รายงานของ SOS (ยอดขาย + สินค้าคงเหลือ) รายสาขารายเดือน
-- แยกจากสต็อกคลังหลักทั้งหมด (ไม่แตะ variant_stock / stock_movements) ใช้ดูต้นทุน กำไร สต็อกที่สาขา และข้อเสนอแนะ SKU
-- ข้อมูลการเงิน (ยอดขาย กำไร ค่าเช่า) ดู/แก้ได้เฉพาะผู้มีสิทธิ์ report.view ส่วน feedback ทีมขายกรอกได้กว้างกว่า

create table if not exists public.sos_branches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null unique,          -- ชื่อสาขาตามหัวรายงาน เช่น NEW SOS SIAM
  rent_monthly numeric(12,2),         -- ค่าเช่าต่อเดือน (กรอกทีหลังได้)
  note text
);

create table if not exists public.sos_imports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  branch_id uuid not null references public.sos_branches (id),
  file_name text,
  period_start date not null,
  period_end date not null,
  stock_as_of date,
  imported_by uuid references public.profiles (id),
  imported_by_name text,
  unique (branch_id, period_start, period_end)
);

-- สรุปท้ายรายงาน (ตัวเลขตามที่ SOS คำนวณ) และยอดแยกตามส่วนของรายงาน (main = ส่วนที่ SOS คิดเป็นยอดขายรวม, credit = ส่วน "เอกสาร ชำระเป็น บัตรเครดิต")
create table if not exists public.sos_summaries (
  import_id uuid primary key references public.sos_imports (id) on delete cascade,
  sales_total numeric(14,2),
  gp numeric(14,2),
  after_gp numeric(14,2),
  other_fees numeric(14,2),
  received numeric(14,2),
  wht numeric(14,2),
  received_incl_vat numeric(14,2),
  vat numeric(14,2),
  received_ex_vat numeric(14,2),
  main_qty integer not null default 0,
  main_net numeric(14,2) not null default 0,
  credit_qty integer not null default 0,
  credit_net numeric(14,2) not null default 0,
  main_cogs numeric(14,2) -- ต้นทุนของส่วน main ตามกติกาต้นทุน ณ วันที่นำเข้า (200 บาทต่อชิ้น เสื้อสูท 400 ค่าส่งไม่นับ)
);

create table if not exists public.sos_sales_lines (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.sos_imports (id) on delete cascade,
  branch_id uuid not null references public.sos_branches (id),
  section text not null check (section in ('main', 'credit')),
  sos_code text not null,
  description text not null,
  qty integer not null,
  unit_price numeric(12,2),
  gross numeric(14,2),
  discount numeric(14,2),
  net numeric(14,2),
  variant_id uuid references public.product_variants (id)
);

create table if not exists public.sos_stock_lines (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.sos_imports (id) on delete cascade,
  branch_id uuid not null references public.sos_branches (id),
  as_of date not null,
  sos_code text not null,
  description text not null,
  qty integer not null,
  variant_id uuid references public.product_variants (id)
);

-- จับคู่รหัสสินค้าของ SOS กับตัวเลือกสินค้า (สี/ไซซ์) ของเรา ใช้ทุกเดือน
create table if not exists public.sos_code_map (
  sos_code text primary key,
  variant_id uuid not null references public.product_variants (id),
  updated_at timestamptz not null default now()
);

create table if not exists public.sos_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  branch_id uuid references public.sos_branches (id),
  product_name text,
  sos_code text,
  kind text not null check (kind in ('good', 'bad', 'request', 'other')),
  note text not null,
  author_id uuid references public.profiles (id),
  author_name text not null
);

create index if not exists sos_sales_lines_import_idx on public.sos_sales_lines (import_id);
create index if not exists sos_stock_lines_import_idx on public.sos_stock_lines (import_id);
create index if not exists sos_feedback_created_idx on public.sos_feedback (created_at desc);

alter table public.sos_branches enable row level security;
alter table public.sos_imports enable row level security;
alter table public.sos_summaries enable row level security;
alter table public.sos_sales_lines enable row level security;
alter table public.sos_stock_lines enable row level security;
alter table public.sos_code_map enable row level security;
alter table public.sos_feedback enable row level security;

-- ข้อมูลการเงินและรายการนำเข้า: ผู้มีสิทธิ์ report.view อ่าน/เขียนได้ทั้งหมด
do $$
declare
  t text;
begin
  foreach t in array array['sos_branches', 'sos_imports', 'sos_summaries', 'sos_sales_lines', 'sos_stock_lines', 'sos_code_map']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format('create policy %I on public.%I for all using (public.has_perm(''report.view'')) with check (public.has_perm(''report.view''))', t || '_all', t);
  end loop;
end $$;

-- feedback: ทีมที่ทำงานกับสต็อก/ขาย และผู้ดูรายงาน อ่านและเพิ่มได้ ลบ/แก้ได้เฉพาะของตัวเอง
drop policy if exists sos_feedback_select on public.sos_feedback;
create policy sos_feedback_select on public.sos_feedback for select
  using (public.has_any_perm(array['report.view', 'stock.in', 'stock.out', 'order.create']));
drop policy if exists sos_feedback_insert on public.sos_feedback;
create policy sos_feedback_insert on public.sos_feedback for insert
  with check (author_id = auth.uid() and public.has_any_perm(array['report.view', 'stock.in', 'stock.out', 'order.create']));
drop policy if exists sos_feedback_delete on public.sos_feedback;
create policy sos_feedback_delete on public.sos_feedback for delete
  using (author_id = auth.uid() or public.has_perm('report.view'));
