# ALFA TRANSPORTES • SPAL • ECOLAB

Sistema definitivo para controle de relatórios, processos, conferências e liberações.

---

# FLUXO DO SISTEMA

O sistema possui somente dois estados:

## 1. AGUARDANDO CONFERÊNCIA

Quando um Word novo é importado:

Status:

AGUARDANDO CONFERÊNCIA

Senha:

—

---

## 2. LIBERADA

Depois que a SPAL realizar a conferência:

O administrador informa a senha.

Exemplo:

Senha:

37742

Status:

LIBERADA

---

# REGRA IMPORTANTE

A senha pertence ao RELATÓRIO.

Não existe senha individual por nota.

Exemplo:

RELATÓRIO 09/09

Senha:

37742

Processos:

CT-e 10/13104576
CT-e 263/13106595
CT-e 263/13115582

Todos automaticamente mostram:

37742

---

# ESTRUTURA

index.html

Interface do sistema.

---

style.css

Visual do sistema.

---

app.js

Responsável por:

- login
- logout
- consultas
- dashboard
- pesquisa
- importação Word
- liberação
- interface ECOLAB

---

supabase.sql

Responsável por:

- banco
- tabelas
- índices
- RLS
- usuários
- regras de segurança
- trigger
- dados de demonstração

---

# CONFIGURAÇÃO DO SUPABASE

## 1

Crie seu projeto no Supabase.

## 2

Abra:

SQL Editor

## 3

Cole todo o conteúdo de:

supabase.sql

## 4

Execute.

---

# CRIAR USUÁRIO ADMIN

Abra:

Authentication

Users

Add user

Crie o usuário.

Depois execute:

```sql
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