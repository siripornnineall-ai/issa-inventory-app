-- Lets the storefront's "Find Your Perfect Fit" cards use a specific,
-- chosen photo per shape/fit instead of auto-picking the first matching
-- product. Not exposed in the inventory app's own UI yet -- rows are set
-- via SQL (ask Claude to point a fit at a specific product's photo) until
-- a proper settings screen exists. No sensitive data (just a label + a
-- public image URL), so it follows the same public-view pattern as
-- 0002_storefront_public_views.sql.

create table storefront_fit_covers (
  shape_label text primary key,
  image_url text not null,
  alt_text text,
  updated_at timestamptz not null default now()
);

alter table storefront_fit_covers enable row level security;

create policy storefront_fit_covers_select on storefront_fit_covers
  for select using (auth_is_active());
create policy storefront_fit_covers_write on storefront_fit_covers
  for all using (auth_role() = any (array['admin'::user_role, 'manager'::user_role]));

create view storefront_fit_covers_public as
select shape_label, image_url, alt_text
from storefront_fit_covers;

grant select on storefront_fit_covers_public to anon, authenticated;
