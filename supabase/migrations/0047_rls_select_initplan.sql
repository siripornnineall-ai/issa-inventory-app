-- เปิดแอปช้า (ต้นเหตุที่สอง): นโยบายอ่าน (SELECT) ของทุกตารางเรียก auth_is_active() ซึ่งค้นตาราง profiles "ทุกแถว" ที่อ่าน
-- (stock_movements 7,000 แถวต่อหน้า = 200 ms ต่อหน้าแทนที่จะเป็น ~8 ms) ห่อด้วย (select ...) ให้ Postgres คำนวณครั้งเดียวต่อคำสั่ง
-- ความหมายเดิมทุกอย่าง (ผู้ใช้ที่ active อ่านได้ ที่เหลืออ่านไม่ได้) ย้อนกลับ: alter policy <ชื่อ> on public.<ตาราง> using (auth_is_active());
do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and cmd = 'SELECT' and qual = 'auth_is_active()' loop
    execute format('alter policy %I on public.%I using ((select public.auth_is_active()))', r.policyname, r.tablename);
  end loop;
end $$;
