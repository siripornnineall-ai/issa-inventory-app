-- 0048: นโยบาย RLS แบบ ALL/SELECT ที่เรียก has_perm()/has_any_perm() ถูกประเมิน "ทุกแถว"
-- (นโยบาย ALL ใช้กับ SELECT ด้วย) ทำให้ดึงตารางใหญ่ตอนเปิดแอปช้า (variant_stock ~140 ms ต่อหน้า)
-- ห่อเป็น (select ...) ให้คำนวณครั้งเดียวต่อคำสั่ง ความหมายสิทธิ์เหมือนเดิมทุกประการ
-- ย้อนกลับ: ถอด "(select " ... ")" รอบฟังก์ชันออก
do $$
declare
  p record;
  new_qual text;
  new_check text;
  fn_re text := '(has_perm\(''[^'']*''::text\)|has_any_perm\(ARRAY\[[^\]]*\]\))';
  sql text;
begin
  for p in
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and cmd in ('ALL', 'SELECT')
      and (coalesce(qual,'') || coalesce(with_check,'')) ~ 'has_(any_)?perm'
      and (coalesce(qual,'') || coalesce(with_check,'')) !~ '\(\s*SELECT\s+(public\.)?has_'
  loop
    new_qual := regexp_replace(p.qual, fn_re, '(select \1)', 'g');
    sql := format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, new_qual);
    if p.with_check is not null then
      new_check := regexp_replace(p.with_check, fn_re, '(select \1)', 'g');
      sql := sql || format(' with check (%s)', new_check);
    end if;
    execute sql;
  end loop;
end $$;
