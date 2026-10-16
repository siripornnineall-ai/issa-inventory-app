-- คลังสินค้าเบิกขายไม่ได้ เพราะเบิกแบบขายสร้างออเดอร์ด้วย แต่ตำแหน่งนี้ไม่มี order.create / ฝ่ายขายยังรับเข้าไม่ได้
insert into public.role_permissions (role, permission) values
  ('warehouse', 'order.create'),
  ('sales', 'stock.in')
on conflict do nothing;
