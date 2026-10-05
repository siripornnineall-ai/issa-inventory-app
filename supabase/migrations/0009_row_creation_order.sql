-- ลำดับการสร้างแถว สำหรับตารางที่ไม่มี created_at
-- เดิมแอปดึงข้อมูลแบบไม่เรียงลำดับ (ได้ตามลำดับที่เก็บจริงในตาราง ≈ ลำดับที่สร้าง) พอเปลี่ยนไปดึงทีละ 1,000 แถว
-- ต้องเรียงด้วยคอลัมน์ที่แน่นอน ถ้าเรียงด้วย id (uuid สุ่ม) สี/ไซซ์/รายการในเอกสารจะสลับมั่ว
-- จึงเพิ่ม created_at ให้ตัวเลือกสินค้าและรายการบรรทัดของเอกสาร โดยเติมค่าเดิมตามลำดับที่เก็บอยู่ตอนนี้
-- (ctid) เพื่อให้ลำดับเดิมที่ผู้ใช้เห็นอยู่ไม่เปลี่ยน แถวใหม่ได้เวลาปัจจุบันตามลำดับการ insert

do $$
declare
  t text;
begin
  foreach t in array array['product_variants', 'stock_in_lines', 'stock_out_lines', 'transfer_lines', 'order_lines']
  loop
    execute format('alter table public.%I add column if not exists created_at timestamptz', t);
    execute format(
      'update public.%I x set created_at = timestamptz ''2026-01-01 00:00:00+00'' + (s.rn * interval ''1 millisecond'') from (select id as rid, row_number() over (order by ctid) as rn from public.%I) s where x.id = s.rid and x.created_at is null',
      t, t
    );
    execute format('alter table public.%I alter column created_at set default clock_timestamp()', t);
    execute format('alter table public.%I alter column created_at set not null', t);
  end loop;
end $$;
