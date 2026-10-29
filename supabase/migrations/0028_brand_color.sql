-- สีประจำแบรนด์ (รหัสสี #RRGGBB) ใช้แสดงป้ายชื่อแบรนด์/แถบสีบนการ์ดในแอป ไม่กระทบสต็อกหรือข้อมูลอื่น
-- ค่าเริ่มต้นเอามาจากสีพื้นโลโก้ของแต่ละแบรนด์ ผู้ดูแลแก้ได้ในหน้าตั้งค่า
alter table public.brands
  add column if not exists color text;

alter table public.brands
  drop constraint if exists brands_color_hex;
alter table public.brands
  add constraint brands_color_hex check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');

update public.brands set color = '#5DADC6' where code = 'IA' and color is null; -- ISSA Activewear (ฟ้าน้ำทะเล)
update public.brands set color = '#000000' where code = 'FS' and color is null; -- Fasonaf (ดำ)
update public.brands set color = '#0A3941' where code = 'IS' and color is null; -- ISSA Apparel (เขียวอมฟ้าเข้ม)
