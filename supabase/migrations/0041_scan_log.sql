-- สมุดบันทึกการสแกน QR (รับเข้า / เบิกออก / รับคืน): บันทึกตั้งแต่ตอนยิง ไม่รอกดบันทึกใบ
-- ใช้ตรวจว่าใครยิงอะไร เมื่อไร ผลเป็นอย่างไร และยิงแล้วถูกบันทึกลงใบหรือยัง (saved_doc_no ว่าง = ยังไม่ได้บันทึกลงใบ)
-- เป็นข้อมูลตรวจสอบอย่างเดียว ไม่แตะสต็อกหรือป้าย (unit_tokens) เพิ่มอย่างเดียว ลบไม่ได้ แก้ได้เฉพาะการเติม saved_doc_no ครั้งเดียวโดยคนที่ยิงเอง

create table if not exists public.scan_log (
  id uuid primary key,
  scanned_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  token_id uuid not null,
  token_code text,
  variant_id uuid,
  action text not null check (action in ('in', 'out')),
  page text not null check (page in ('stock_in', 'stock_out', 'stock_return')),
  outcome text not null check (outcome in ('ok', 'duplicate', 'rejected')),
  reason text,
  actor_id uuid not null references public.profiles (id),
  actor_name text not null,
  saved_doc_no text
);

create index if not exists scan_log_scanned_at_idx on public.scan_log (scanned_at desc);
create index if not exists scan_log_actor_idx on public.scan_log (actor_id, scanned_at desc);
create index if not exists scan_log_token_idx on public.scan_log (token_id);

alter table public.scan_log enable row level security;

drop policy if exists scan_log_select on public.scan_log;
create policy scan_log_select on public.scan_log for select using (public.has_perm('view.history'));

drop policy if exists scan_log_insert on public.scan_log;
create policy scan_log_insert on public.scan_log for insert
  with check (actor_id = auth.uid() and public.has_any_perm(array['stock.in', 'stock.out', 'stock.adjust', 'stock.transfer', 'order.create']));

-- ผู้ยิงเติมเลขที่ใบให้การสแกนของตัวเองที่ยังว่างอยู่เท่านั้น
drop policy if exists scan_log_update on public.scan_log;
create policy scan_log_update on public.scan_log for update
  using (actor_id = auth.uid() and saved_doc_no is null and public.has_any_perm(array['stock.in', 'stock.out', 'stock.adjust', 'stock.transfer', 'order.create']))
  with check (actor_id = auth.uid());

create or replace function public.protect_scan_log() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'ห้ามลบประวัติการสแกน';
  end if;
  if (new.id, new.scanned_at, new.recorded_at, new.token_id, new.token_code, new.variant_id, new.action, new.page, new.outcome, new.reason, new.actor_id, new.actor_name)
     is distinct from
     (old.id, old.scanned_at, old.recorded_at, old.token_id, old.token_code, old.variant_id, old.action, old.page, old.outcome, old.reason, old.actor_id, old.actor_name) then
    raise exception 'แก้ไขประวัติการสแกนไม่ได้ (เติมได้เฉพาะเลขที่ใบ)';
  end if;
  if old.saved_doc_no is not null and new.saved_doc_no is distinct from old.saved_doc_no then
    raise exception 'เลขที่ใบของการสแกนนี้ถูกเติมไปแล้ว แก้ไม่ได้';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_scan_log on public.scan_log;
create trigger trg_protect_scan_log
  before update or delete on public.scan_log
  for each row execute function public.protect_scan_log();
