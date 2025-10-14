
-- politicians
create table if not exists politicians (
  id text primary key,
  name text not null,
  chamber text not null check (chamber in ('house','senate')),
  party text not null,
  state text,
  active_from timestamptz,
  active_to timestamptz,
  committee_roles jsonb default '[]'::jsonb
);

-- disclosures
create table if not exists disclosures (
  id text primary key,
  politician_id text references politicians(id) on delete cascade,
  source text not null,
  filed_at timestamptz not null,
  type text not null check (type in ('PTR','FD')),
  pdf_url text,
  sha256 text
);

-- trades
create table if not exists trades (
  id text primary key,
  disclosure_id text references disclosures(id) on delete cascade,
  trade_date date not null,
  owner text not null,
  asset_type text not null,
  issuer_raw text not null,
  mapped_ticker text,
  txn text not null,
  amount_min numeric,
  amount_max numeric,
  notes text
);

-- trade_metrics
create table if not exists trade_metrics (
  trade_id text references trades(id) on delete cascade,
  window text not null,
  abs_return numeric not null,
  excess_spy numeric,
  excess_sector numeric,
  primary key (trade_id, window)
);

-- news (optional cache)
create table if not exists news (
  id text primary key,
  url text not null,
  source text,
  title text,
  summary text,
  published_at timestamptz,
  sentiment numeric,
  entities jsonb default '[]'::jsonb
);

-- seed one politician so /imports/ptr works
insert into politicians(id,name,chamber,party,state)
values ('pol_demo','Demo Member','house','I','DC')
on conflict (id) do nothing;
