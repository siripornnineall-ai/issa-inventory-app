-- สำรองข้อมูลรายวันในฐานข้อมูลเอง: สำเนาทุกตาราง public ลง schema snap_YYYYMMDD_HHMM (เก็บ 14 ชุดล่าสุด)
-- ใช้กู้คืนกรณีลบ/แก้ข้อมูลผิด หรือ migration พัง ไม่ใช่สำรองระดับโปรเจกต์ (อันนั้นคือ Backups ของ Supabase เอง)
-- schema พวกนี้ไม่เปิดให้ API (anon/authenticated) เข้าถึง และไม่เก็บรหัสผ่านของผู้ใช้
create extension if not exists pg_cron;

create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;

create or replace function backup.snapshot()
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  s text := 'snap_' || to_char(now() at time zone 'Asia/Bangkok', 'YYYYMMDD_HH24MI');
  t record;
begin
  if exists (select 1 from pg_namespace where nspname = s) then
    s := s || '_' || floor(extract(epoch from clock_timestamp()))::bigint::text;
  end if;
  execute format('create schema %I', s);
  for t in select tablename from pg_tables where schemaname = 'public' order by tablename loop
    execute format('create table %I.%I as table public.%I', s, t.tablename, t.tablename);
  end loop;
  -- รายชื่อผู้ใช้ (ไม่รวมรหัสผ่าน) และรายการไฟล์ใน Storage (เฉพาะข้อมูลอธิบายไฟล์ ไม่ใช่ตัวไฟล์)
  execute format('create table %I.%I as select id, email, created_at, last_sign_in_at, banned_until, raw_user_meta_data from auth.users', s, 'auth_users_no_password');
  execute format('create table %I.%I as select bucket_id, name, owner, created_at, updated_at, metadata from storage.objects', s, 'storage_objects_meta');
  execute format('revoke all on schema %I from public, anon, authenticated', s);
  return s;
end;
$$;

-- ลบชุดสำรองเก่า เหลือ p_keep ชุดล่าสุด
create or replace function backup.prune(p_keep int default 14)
returns int
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  r record;
  dropped int := 0;
begin
  if p_keep < 3 then
    raise exception 'เก็บอย่างน้อย 3 ชุด';
  end if;
  for r in
    select nspname from pg_namespace
    where nspname ~ '^snap_[0-9]{8}_[0-9]{4}'
    order by nspname desc
    offset p_keep
  loop
    execute format('drop schema %I cascade', r.nspname);
    dropped := dropped + 1;
  end loop;
  return dropped;
end;
$$;

-- เทียบชุดสำรองกับข้อมูลปัจจุบันทุกตาราง (จำนวนแถว + เนื้อหา) ใช้ตรวจว่าสำเนาครบ ถ้าข้อมูลเปลี่ยนหลังสำรอง same จะเป็น false
create or replace function backup.verify(p_schema text)
returns table (tbl text, live_rows bigint, snap_rows bigint, same boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  t record;
  lr bigint;
  sr bigint;
  lh text;
  sh text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' order by tablename loop
    execute format('select count(*), coalesce(md5(string_agg(x::text, '''' order by x::text)), '''') from public.%I x', t.tablename) into lr, lh;
    execute format('select count(*), coalesce(md5(string_agg(x::text, '''' order by x::text)), '''') from %I.%I x', p_schema, t.tablename) into sr, sh;
    tbl := t.tablename; live_rows := lr; snap_rows := sr; same := (lr = sr and lh = sh);
    return next;
  end loop;
end;
$$;

revoke all on function backup.snapshot() from public, anon, authenticated;
revoke all on function backup.prune(int) from public, anon, authenticated;
revoke all on function backup.verify(text) from public, anon, authenticated;

-- ทุกวัน 03:00 เวลาไทย (20:00 UTC) สำรองแล้วลบชุดที่เก่ากว่า 14 ชุด
select cron.unschedule('daily-backup-snapshot') where exists (select 1 from cron.job where jobname = 'daily-backup-snapshot');
select cron.schedule('daily-backup-snapshot', '0 20 * * *', $cron$select backup.snapshot(); select backup.prune(14);$cron$);
