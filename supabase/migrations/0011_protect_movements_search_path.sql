-- ตั้ง search_path ให้ฟังก์ชันกันแก้ประวัติสต็อก (Supabase security advisor: function_search_path_mutable)
alter function public.protect_stock_movements() set search_path = public, pg_temp;
