-- ==========================================================
-- ALFA TRANSPORTES / SPAL / ECOLAB
-- BANCO DEFINITIVO
-- ==========================================================


-- EXTENSÃO
-- ==========================================================

create extension if not exists pgcrypto;



-- ==========================================================
-- RELATÓRIOS
-- ==========================================================

create table if not exists public.relatorios (

    id uuid
        primary key
        default gen_random_uuid(),

    report_date date
        not null,

    imported_at timestamptz
        not null
        default now(),

    password text,

    status text
        not null
        default 'AGUARDANDO CONFERÊNCIA'

        check (
            status in (
                'AGUARDANDO CONFERÊNCIA',
                'LIBERADA'
            )
        ),

    created_by uuid
        references auth.users(id),

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now()

);



-- ==========================================================
-- PROCESSOS
-- ==========================================================

create table if not exists public.processos (

    id uuid
        primary key
        default gen_random_uuid(),

    report_id uuid
        not null
        references public.relatorios(id)
        on delete cascade,

    data date,

    cte text
        not null,

    nf text
        not null,

    cliente text,

    volume text,

    acr text,

    created_at timestamptz
        not null
        default now()

);



-- ==========================================================
-- ÍNDICES
-- ==========================================================

create index if not exists
idx_relatorios_report_date
on public.relatorios(
    report_date desc
);


create index if not exists
idx_processos_report_id
on public.processos(
    report_id
);


create index if not exists
idx_processos_cte
on public.processos(
    cte
);


create index if not exists
idx_processos_nf
on public.processos(
    nf
);


create index if not exists
idx_processos_acr
on public.processos(
    acr
);


create index if not exists
idx_processos_cliente
on public.processos(
    cliente
);



-- ==========================================================
-- TRIGGER
--
-- Garante a regra:
--
-- AGUARDANDO CONFERÊNCIA = sem senha
--
-- LIBERADA = obrigatoriamente com senha
-- ==========================================================

create or replace function
public.validate_relatorio()

returns trigger

language plpgsql

as $$

begin

    if
        new.status = 'LIBERADA'
        and
        nullif(
            trim(new.password),
            ''
        ) is null
    then

        raise exception
            'Um relatório só pode ser LIBERADA quando possuir senha.';

    end if;


    if
        new.status =
        'AGUARDANDO CONFERÊNCIA'
    then

        new.password := null;

    end if;


    new.updated_at :=
        now();


    return new;

end;

$$;



drop trigger if exists
trg_validate_relatorio
on public.relatorios;


create trigger
trg_validate_relatorio

before insert or update
on public.relatorios

for each row

execute function
public.validate_relatorio();



-- ==========================================================
-- FUNÇÕES DE AUTORIZAÇÃO
--
-- O sistema usa APP_METADATA.
-- ==========================================================


create or replace function
public.is_admin()

returns boolean

language sql

stable

security definer

set search_path = public

as $$

    select coalesce(

        auth.jwt()
            ->'app_metadata'
            ->>'role'
            =
            'admin',

        false

    );

$$;



create or replace function
public.is_client()

returns boolean

language sql

stable

security definer

set search_path = public

as $$

    select coalesce(

        auth.jwt()
            ->'app_metadata'
            ->>'role'
            =
            'client',

        false

    );

$$;



-- ==========================================================
-- RLS
-- ==========================================================

alter table public.relatorios
enable row level security;


alter table public.processos
enable row level security;



-- ==========================================================
-- ADMIN
-- RELATÓRIOS
-- ==========================================================

drop policy if exists
"admin_relatorios_all"
on public.relatorios;


create policy
"admin_relatorios_all"

on public.relatorios

for all

to authenticated

using (
    public.is_admin()
)

with check (
    public.is_admin()
);



-- ==========================================================
-- ECOLAB
-- RELATÓRIOS
--
-- O cliente somente consegue visualizar
-- relatórios que possuam pelo menos
-- um processo ECOLAB.
-- ==========================================================

drop policy if exists
"client_relatorios_ecolab_select"
on public.relatorios;


create policy
"client_relatorios_ecolab_select"

on public.relatorios

for select

to authenticated

using (

    public.is_client()

    and

    exists (

        select 1

        from public.processos p

        where
            p.report_id =
            relatorios.id

            and

            upper(
                trim(
                    coalesce(
                        p.cliente,
                        ''
                    )
                )
            )
            =
            'ECOLAB'

    )

);



-- ==========================================================
-- ADMIN
-- PROCESSOS
-- ==========================================================

drop policy if exists
"admin_processos_all"
on public.processos;


create policy
"admin_processos_all"

on public.processos

for all

to authenticated

using (
    public.is_admin()
)

with check (
    public.is_admin()
);



-- ==========================================================
-- ECOLAB
-- PROCESSOS
-- ==========================================================

drop policy if exists
"client_processos_ecolab_select"
on public.processos;


create policy
"client_processos_ecolab_select"

on public.processos

for select

to authenticated

using (

    public.is_client()

    and

    upper(
        trim(
            coalesce(
                cliente,
                ''
            )
        )
    )
    =
    'ECOLAB'

);



-- ==========================================================
-- CONFIGURAÇÃO DOS USUÁRIOS
-- ==========================================================

/*

PRIMEIRO:

Crie os usuários em:

Authentication
→ Users
→ Add user


DEPOIS:

Defina o ADMIN:


update auth.users

set raw_app_meta_data =
    coalesce(
        raw_app_meta_data,
        '{}'::jsonb
    )
    ||
    '{"role":"admin"}'::jsonb

where email =
    'SEU_EMAIL_ADMIN';


CLIENTE ECOLAB:


update auth.users

set raw_app_meta_data =
    coalesce(
        raw_app_meta_data,
        '{}'::jsonb
    )
    ||
    '{"role":"client","client_name":"ECOLAB"}'::jsonb

where email =
    'EMAIL_DO_CLIENTE_ECOLAB';


*/


-- ==========================================================
-- VERIFICAR USUÁRIOS
-- ==========================================================

/*

select
    id,
    email,
    raw_app_meta_data

from auth.users

order by created_at desc;

*/



-- ==========================================================
-- DADOS DE DEMONSTRAÇÃO
-- ==========================================================

do $$

declare

    r1 uuid;

    r2 uuid;

begin


    -- ------------------------------------------------------
    -- RELATÓRIO 17/09/2026
    -- ------------------------------------------------------

    if not exists (

        select 1

        from public.relatorios

        where report_date =
            '2026-09-17'

    ) then


        insert into public.relatorios(

            report_date,

            password,

            status

        )

        values (

            '2026-09-17',

            null,

            'AGUARDANDO CONFERÊNCIA'

        )

        returning id
        into r1;


        insert into public.processos(

            report_id,

            data,

            cte,

            nf,

            cliente,

            volume,

            acr

        )

        values

        (

            r1,

            '2026-09-17',

            '10/13152815',

            '867137',

            'ECOLAB',

            '08',

            '6545516'

        ),

        (

            r1,

            '2026-09-17',

            '263/13153216',

            '578090',

            'ECOLAB',

            '2',

            '6546099'

        ),

        (

            r1,

            '2026-09-17',

            '11/8025995',

            '398570',

            'ELETRO NACIONAL',

            '1',

            '6542737'

        ),

        (

            r1,

            '2026-09-17',

            '263/13152967',

            '777621',

            'KLUBER',

            '1',

            '6545691'

        );


    end if;



    -- ------------------------------------------------------
    -- RELATÓRIO 09/09/2026
    -- ------------------------------------------------------

    if not exists (

        select 1

        from public.relatorios

        where report_date =
            '2026-09-09'

    ) then


        insert into public.relatorios(

            report_date,

            password,

            status

        )

        values (

            '2026-09-09',

            '37742',

            'LIBERADA'

        )

        returning id
        into r2;


        insert into public.processos(

            report_id,

            data,

            cte,

            nf,

            cliente,

            volume,

            acr

        )

        values

        (

            r2,

            '2026-09-09',

            '10/13104576',

            '865440',

            'ECOLAB',

            '2',

            '6467316'

        ),

        (

            r2,

            '2026-09-09',

            '263/13106595',

            '573683',

            'ECOLAB',

            '1',

            '6470384'

        ),

        (

            r2,

            '2026-09-09',

            '263/13115582',

            '8425',

            'PROFILTRO',

            '1',

            '6485136'

        ),

        (

            r2,

            '2026-09-09',

            '263/13115583',

            '8426',

            'PROFILTRO',

            '1',

            '6485137'

        ),

        (

            r2,

            '2026-09-09',

            '52/13120478',

            '15975',

            'MOVEX',

            '1',

            '6493342'

        );


    end if;


end $$;



-- ==========================================================
-- CONSULTA DE CONFERÊNCIA
-- ==========================================================

/*

select

    r.report_date,

    r.password,

    r.status,

    p.cte,

    p.nf,

    p.cliente,

    p.volume,

    p.acr

from public.relatorios r

join public.processos p

    on p.report_id =
       r.id

order by

    r.report_date desc,

    p.id;

*/