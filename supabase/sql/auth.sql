-- Sign-in for the whole website: users, sessions and the functions the site calls.
-- Passwords are stored only as bcrypt hashes. The tables cannot be read from the browser (row level security with no
-- policies); the site talks to them only through the functions below. Applied to the project as migration "site_login".

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  username_key text not null unique,            -- lower case, no spaces: "Biodiversity and Research" and "biodiversityandresearch" are the same user
  password_hash text not null,
  role text not null check (role in ('admin', 'staff', 'user')),
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.app_sessions (
  token_hash text primary key,                  -- sha256 of the token kept in the browser cookie
  user_id uuid not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  expires_at timestamptz not null
);
create table if not exists public.app_login_attempts (
  id bigserial primary key,
  username_key text not null,
  at timestamptz not null default now()
);
create index if not exists app_login_attempts_idx on public.app_login_attempts (username_key, at);

alter table public.app_users enable row level security;
alter table public.app_sessions enable row level security;
alter table public.app_login_attempts enable row level security;
revoke all on public.app_users, public.app_sessions, public.app_login_attempts from anon, authenticated;

create or replace function public.app_norm(p text) returns text language sql immutable as
$$ select lower(regexp_replace(trim(coalesce(p, '')), '\s+', '', 'g')) $$;

-- The user behind a valid token (internal: not callable from the browser).
create or replace function public.app_session_user(p_token text) returns public.app_users
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.app_users;
begin
  select au.* into u
    from public.app_sessions s join public.app_users au on au.id = s.user_id
   where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') and s.expires_at > now() and not au.disabled;
  return u;
end $$;
revoke all on function public.app_session_user(text) from public, anon, authenticated;

create or replace function public.app_login(p_username text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare k text := public.app_norm(p_username); u public.app_users; tok text; fails int; recent int;
begin
  delete from public.app_login_attempts where at < now() - interval '1 day';
  select count(*) into fails from public.app_login_attempts where username_key = k and at > now() - interval '15 minutes';
  select count(*) into recent from public.app_login_attempts where at > now() - interval '1 minute';
  if fails >= 8 or recent >= 200 then return jsonb_build_object('error', 'too_many'); end if;
  select * into u from public.app_users where username_key = k and not disabled;
  if u.id is null or u.password_hash <> crypt(coalesce(p_password, ''), u.password_hash) then
    insert into public.app_login_attempts (username_key) values (left(k, 80));
    return jsonb_build_object('error', 'invalid');
  end if;
  delete from public.app_login_attempts where username_key = k;
  delete from public.app_sessions where expires_at < now();
  tok := encode(gen_random_bytes(32), 'hex');
  insert into public.app_sessions (token_hash, user_id, expires_at)
    values (encode(digest(tok, 'sha256'), 'hex'), u.id, now() + interval '14 days');
  return jsonb_build_object('token', tok, 'username', u.username, 'role', u.role);
end $$;

create or replace function public.app_check_session(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.app_users; h text := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
begin
  u := public.app_session_user(p_token);
  if u.id is null then return null; end if;
  update public.app_sessions set last_seen = now() where token_hash = h and last_seen < now() - interval '60 seconds';
  return jsonb_build_object('username', u.username, 'role', u.role);
end $$;

create or replace function public.app_logout(p_token text) returns void
language sql security definer set search_path = public, extensions, pg_temp as $$
  delete from public.app_sessions where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
$$;

create or replace function public.app_list_users(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare me public.app_users;
begin
  me := public.app_session_user(p_token);
  if me.id is null or me.role <> 'admin' then return jsonb_build_object('error', 'forbidden'); end if;
  return jsonb_build_object('users', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', au.id, 'username', au.username, 'role', au.role, 'disabled', au.disabled, 'created_at', au.created_at,
      'last_seen', ls.last_seen, 'active', coalesce(ls.last_seen > now() - interval '5 minutes', false), 'me', au.id = me.id
    ) order by coalesce(ls.last_seen > now() - interval '5 minutes', false) desc, au.username)
    from public.app_users au
    left join lateral (select max(s.last_seen) as last_seen from public.app_sessions s where s.user_id = au.id and s.expires_at > now()) ls on true
  ), '[]'::jsonb));
end $$;

create or replace function public.app_add_user(p_token text, p_username text, p_password text, p_role text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare me public.app_users; k text := public.app_norm(p_username);
begin
  me := public.app_session_user(p_token);
  if me.id is null or me.role <> 'admin' then return jsonb_build_object('error', 'forbidden'); end if;
  if length(trim(coalesce(p_username, ''))) < 3 or length(trim(p_username)) > 40 then return jsonb_build_object('error', 'The user name must be 3 to 40 characters.'); end if;
  if length(coalesce(p_password, '')) < 8 or length(p_password) > 100 then return jsonb_build_object('error', 'The password must be at least 8 characters.'); end if;
  if p_role not in ('admin', 'staff', 'user') then return jsonb_build_object('error', 'Choose an access level.'); end if;
  if exists (select 1 from public.app_users where username_key = k) then return jsonb_build_object('error', 'That user name is already taken.'); end if;
  insert into public.app_users (username, username_key, password_hash, role)
    values (trim(p_username), k, crypt(p_password, gen_salt('bf', 10)), p_role);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.app_update_user(p_token text, p_id uuid, p_role text default null, p_disabled boolean default null, p_password text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare me public.app_users; target public.app_users; admins int;
begin
  me := public.app_session_user(p_token);
  if me.id is null or me.role <> 'admin' then return jsonb_build_object('error', 'forbidden'); end if;
  select * into target from public.app_users where id = p_id;
  if target.id is null then return jsonb_build_object('error', 'User not found.'); end if;
  if p_role is not null and p_role not in ('admin', 'staff', 'user') then return jsonb_build_object('error', 'Choose an access level.'); end if;
  if target.id = me.id and ((p_role is not null and p_role <> 'admin') or p_disabled is true) then
    return jsonb_build_object('error', 'You cannot lower or switch off your own access.');
  end if;
  if p_password is not null and (length(p_password) < 8 or length(p_password) > 100) then return jsonb_build_object('error', 'The password must be at least 8 characters.'); end if;
  if p_role is not null then update public.app_users set role = p_role where id = p_id; end if;
  if p_disabled is not null then
    update public.app_users set disabled = p_disabled where id = p_id;
    if p_disabled then delete from public.app_sessions where user_id = p_id; end if;
  end if;
  if p_password is not null then
    update public.app_users set password_hash = crypt(p_password, gen_salt('bf', 10)) where id = p_id;
    delete from public.app_sessions where user_id = p_id and p_id <> me.id;
  end if;
  select count(*) into admins from public.app_users where role = 'admin' and not disabled;
  if admins < 1 then raise exception 'at least one admin is needed'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.app_delete_user(p_token text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare me public.app_users;
begin
  me := public.app_session_user(p_token);
  if me.id is null or me.role <> 'admin' then return jsonb_build_object('error', 'forbidden'); end if;
  if p_id = me.id then return jsonb_build_object('error', 'You cannot remove your own account.'); end if;
  delete from public.app_users where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.app_change_password(p_token text, p_current text, p_new text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare me public.app_users;
begin
  me := public.app_session_user(p_token);
  if me.id is null then return jsonb_build_object('error', 'forbidden'); end if;
  if me.password_hash <> crypt(coalesce(p_current, ''), me.password_hash) then return jsonb_build_object('error', 'The current password is not right.'); end if;
  if length(coalesce(p_new, '')) < 8 or length(p_new) > 100 then return jsonb_build_object('error', 'The new password must be at least 8 characters.'); end if;
  update public.app_users set password_hash = crypt(p_new, gen_salt('bf', 10)) where id = me.id;
  delete from public.app_sessions where user_id = me.id and token_hash <> encode(digest(p_token, 'sha256'), 'hex');
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.app_login(text, text), public.app_check_session(text), public.app_logout(text),
  public.app_list_users(text), public.app_add_user(text, text, text, text), public.app_update_user(text, uuid, text, boolean, text),
  public.app_delete_user(text, uuid), public.app_change_password(text, text, text) from public;
grant execute on function public.app_login(text, text), public.app_check_session(text), public.app_logout(text),
  public.app_list_users(text), public.app_add_user(text, text, text, text), public.app_update_user(text, uuid, text, boolean, text),
  public.app_delete_user(text, uuid), public.app_change_password(text, text, text) to anon, authenticated;

-- ── Staff tools use each person's own account password (migration "staff_personal_login") ──
create table if not exists public.staff_actions (
  id bigserial primary key,
  at timestamptz not null default now(),
  username text not null,
  action text not null,
  detail text
);
alter table public.staff_actions enable row level security;
revoke all on public.staff_actions from anon, authenticated;

-- Checks a staff or admin account for the staff-api function. Only the server (service role) may call it.
create or replace function public.app_verify_staff(p_username text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare k text := public.app_norm(p_username); u public.app_users; fails int;
begin
  select count(*) into fails from public.app_login_attempts where username_key = 'staff:' || left(k, 80) and at > now() - interval '15 minutes';
  if fails >= 8 then return jsonb_build_object('error', 'too_many'); end if;
  select * into u from public.app_users where username_key = k and not disabled;
  if u.id is null or u.password_hash <> crypt(coalesce(p_password, ''), u.password_hash) then
    insert into public.app_login_attempts (username_key) values ('staff:' || left(k, 80));
    return jsonb_build_object('error', 'invalid');
  end if;
  if u.role not in ('staff', 'admin') then return jsonb_build_object('error', 'not_staff'); end if;
  delete from public.app_login_attempts where username_key = 'staff:' || left(k, 80);
  return jsonb_build_object('username', u.username, 'role', u.role);
end $$;
revoke all on function public.app_verify_staff(text, text) from public, anon, authenticated;
grant execute on function public.app_verify_staff(text, text) to service_role;
