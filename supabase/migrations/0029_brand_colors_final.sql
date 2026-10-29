-- สีประจำแบรนด์ที่เจ้าของงานเลือก (29 ต.ค. 2026) แทนค่าตั้งต้นจากสีพื้นโลโก้ใน 0028
-- เปลี่ยนเฉพาะแถวที่ยังเป็นค่าตั้งต้นของ 0028 ถ้าผู้ดูแลแก้สีเองในหน้าตั้งค่าแล้วจะไม่ถูกทับ
update public.brands set color = '#0A9BDC' where code = 'IA' and color = '#5DADC6'; -- ISSA Activewear ฟ้าสด
update public.brands set color = '#00808A' where code = 'IS' and color = '#0A3941'; -- ISSA Apparel ทีลสว่าง
update public.brands set color = '#691C32' where code = 'FS' and color = '#000000'; -- Fasonaf แดงเข้ม
