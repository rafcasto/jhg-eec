-- Job Hackers — admin credentials for the /admin panel.
--
-- The panel authenticates against the existing public.admins table, using the
-- email as the username. This migration adds the password hash column.
-- Passwords are scrypt-hashed by `npm run seed:admin`; the value looks like
-- `scrypt$<saltHex>$<keyHex>`. A NULL password_hash means that admin cannot log
-- in (they remain in the allowlist but have no credential).
--
-- Run once in the Supabase SQL editor, or via `supabase db push`.

alter table public.admins
  add column if not exists password_hash text;

comment on column public.admins.password_hash is
  'scrypt$<saltHex>$<keyHex> password hash for /admin login. NULL = no login.';
