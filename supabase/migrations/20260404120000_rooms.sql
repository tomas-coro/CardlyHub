-- shortcut: le stanze abbandonate non scadono ancora, aggiungere una pulizia quando il traffico lo richiede.
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  game text not null check (game in ('briscola', 'machiavelli', 'uno', 'burraco', 'dadi')),
  host_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  created_at timestamptz not null default now()
);

create table public.room_players (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seat smallint not null check (seat >= 0),
  name text not null check (char_length(btrim(name)) between 1 and 24),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat)
);

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;

create schema if not exists private;

create function private.is_room_member(target_room uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_players
    where room_id = target_room and user_id = (select auth.uid())
  );
$$;

create policy "members can read their rooms"
on public.rooms for select
to authenticated
using ((select private.is_room_member(id)));

create policy "members can read room players"
on public.room_players for select
to authenticated
using ((select private.is_room_member(room_id)));

create function public.create_room(p_game text, p_name text)
returns table (room_id uuid, room_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  new_code text;
  current_user_id uuid := auth.uid();
  attempts integer := 0;
begin
  if current_user_id is null then raise exception 'Devi accedere per creare una stanza'; end if;
  if p_game not in ('briscola', 'machiavelli', 'uno', 'burraco', 'dadi') then raise exception 'Gioco non valido'; end if;
  if char_length(btrim(p_name)) not between 1 and 24 then raise exception 'Il nome deve avere da 1 a 24 caratteri'; end if;

  loop
    attempts := attempts + 1;
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32)::integer + 1, 1);
    end loop;

    begin
      insert into public.rooms (code, game, host_id)
      values (new_code, p_game, current_user_id)
      returning id into new_id;
      exit;
    exception when unique_violation then
      if attempts >= 5 then raise exception 'Impossibile generare il codice stanza'; end if;
    end;
  end loop;

  insert into public.room_players (room_id, user_id, seat, name)
  values (new_id, current_user_id, 0, btrim(p_name));

  return query select new_id, new_code;
end;
$$;

create function public.join_room(p_code text, p_name text)
returns table (room_id uuid, room_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.rooms;
  current_user_id uuid := auth.uid();
  target_seat smallint;
  max_players smallint;
begin
  if current_user_id is null then raise exception 'Devi accedere per entrare in una stanza'; end if;
  if char_length(btrim(p_name)) not between 1 and 24 then raise exception 'Il nome deve avere da 1 a 24 caratteri'; end if;

  select * into target from public.rooms where code = upper(btrim(p_code)) for update;
  if not found then raise exception 'Stanza non trovata'; end if;
  if target.status <> 'waiting' then raise exception 'La partita è già iniziata'; end if;

  if exists (select 1 from public.room_players where room_id = target.id and user_id = current_user_id) then
    update public.room_players set name = btrim(p_name)
    where room_id = target.id and user_id = current_user_id;
    return query select target.id, target.code;
    return;
  end if;

  max_players := case target.game
    when 'briscola' then 4
    when 'machiavelli' then 6
    when 'uno' then 10
    when 'burraco' then 2
    when 'dadi' then 6
  end;

  select s::smallint into target_seat
  from generate_series(0, max_players - 1) s
  where not exists (
    select 1 from public.room_players p where p.room_id = target.id and p.seat = s
  )
  order by s
  limit 1;

  if target_seat is null then raise exception 'La stanza è piena'; end if;

  insert into public.room_players (room_id, user_id, seat, name)
  values (target.id, current_user_id, target_seat, btrim(p_name));

  return query select target.id, target.code;
end;
$$;

revoke all on public.rooms, public.room_players from anon, authenticated;
grant select on public.rooms, public.room_players to authenticated;
revoke all on function public.create_room(text, text), public.join_room(text, text) from public;
grant execute on function public.create_room(text, text), public.join_room(text, text) to authenticated;

alter publication supabase_realtime add table public.rooms, public.room_players;
