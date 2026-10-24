-- Contact/sales channels as an editable list instead of fixed social_* columns,
-- so the owner can add/remove channels (Shopee, a second LINE, a website...)
-- from Settings without a code change. `platform` picks the icon on the
-- storefront ('link' = generic). Existing values in storefront_settings are
-- copied over; the old columns are left in place (unused) for safety.

create table storefront_channels (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'link',
  label text not null,
  url text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table storefront_channels enable row level security;

create policy storefront_channels_select on storefront_channels
  for select using (auth_is_active());
-- Same permission as the "ข้อความหน้าเว็บ" card these are edited in.
create policy storefront_channels_write on storefront_channels
  for all
  using (public.has_perm('master.write'))
  with check (public.has_perm('master.write'));

create view storefront_channels_public as
select id, platform, label, url, sort_order
from storefront_channels
where active and url <> ''
order by sort_order, created_at;

grant select on storefront_channels_public to anon, authenticated;

insert into storefront_channels (platform, label, url, sort_order)
select v.platform, v.label, v.url, v.sort_order
from storefront_settings s
cross join lateral (values
  ('line',          'LINE',          s.social_line,          0),
  ('facebook',      'Facebook',      s.social_facebook,      1),
  ('instagram',     'Instagram',     s.social_instagram,     2),
  ('tiktok',        'TikTok',        s.social_tiktok,        3),
  ('shopee',        'Shopee',        s.social_shopee,        4),
  ('lazada',        'Lazada',        s.social_lazada,        5),
  ('line-shopping', 'LINE Shopping', s.social_line_shopping, 6),
  ('youtube',       'YouTube',       s.social_youtube,       7)
) as v(platform, label, url, sort_order)
where s.id = 'default' and coalesce(v.url, '') <> '';
