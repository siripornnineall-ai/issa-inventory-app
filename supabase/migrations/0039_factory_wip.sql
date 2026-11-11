-- โรงงาน BC: สต็อกที่ตัดเป็นชิ้นแล้วแต่ยังไม่ได้เย็บ (แยกสี/ไซซ์)
-- เก็บเป็นสมุดบันทึกที่แก้ไม่ได้ (ยอดตั้งต้น / ตัดเข้า / ปรับยอด / เสียหาย) ไม่ปนกับสต็อกสินค้าสำเร็จรูป (variant_stock, stock_movements)
-- ยอดคงเหลือ "ยังไม่เย็บ" = ผลรวม qty_change ของตารางนี้ - จำนวนที่รับเข้าสต็อกแบบ "เย็บเสร็จจากโรงงาน BC" (stock_in_lines.from_wip) ในใบที่ไม่ถูกยกเลิก
-- คิดจากใบรับเข้าโดยตรง จึงไม่มีรายการหักแยก ไม่ค้างครึ่งทาง และยกเลิกใบรับเข้าแล้วยอดยังไม่เย็บกลับมาเอง

create table if not exists public.factory_wip_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  batch_id uuid not null,
  entry_date date not null,
  variant_id uuid not null references public.product_variants (id),
  kind text not null check (kind in ('opening', 'cut_in', 'adjust', 'scrap')),
  qty_change integer not null check (qty_change <> 0),
  note text,
  actor_id uuid references public.profiles (id),
  actor_name text not null
);

create index if not exists factory_wip_entries_variant_idx on public.factory_wip_entries (variant_id);
create index if not exists factory_wip_entries_batch_idx on public.factory_wip_entries (batch_id);

alter table public.factory_wip_entries enable row level security;

drop policy if exists factory_wip_entries_select on public.factory_wip_entries;
create policy factory_wip_entries_select on public.factory_wip_entries for select using (public.auth_is_active());

-- ยอดตั้งต้น/ตัดเข้า ใช้สิทธิ์รับเข้า (stock.in) ส่วนปรับยอด/เสียหายใช้สิทธิ์นับสต็อก/ปรับยอด (stock.adjust) ไม่มีนโยบายแก้/ลบ
drop policy if exists factory_wip_entries_insert on public.factory_wip_entries;
create policy factory_wip_entries_insert on public.factory_wip_entries for insert
  with check (
    (kind in ('opening', 'cut_in') and public.has_perm('stock.in'))
    or (kind in ('adjust', 'scrap') and public.has_perm('stock.adjust'))
  );

create or replace function public.protect_factory_wip_entries() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'ห้ามแก้ไขหรือลบประวัติตัวที่ยังไม่เย็บ ถ้าบันทึกผิดให้บันทึกรายการปรับยอดแทน';
end;
$$;

drop trigger if exists trg_protect_factory_wip_entries on public.factory_wip_entries;
create trigger trg_protect_factory_wip_entries
  before update or delete on public.factory_wip_entries
  for each row execute function public.protect_factory_wip_entries();

-- ใบรับเข้าที่เลือก "รับมาจาก: เย็บเสร็จจากโรงงาน BC" ทุกบรรทัดของใบนั้นถูกหักจากตัวที่ยังไม่เย็บ
alter table public.stock_in_lines
  add column if not exists from_wip boolean not null default false;
