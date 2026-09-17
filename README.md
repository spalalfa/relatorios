# SPAL • Controle de Conferência

Sistema web em HTML/CSS/JS para:
- importar relatórios `.docx`;
- identificar DATA, SENHA e a tabela CTE / NF / REMETENTE / VOLUME / ACR;
- pesquisar por CT-e, Nota Fiscal, ACR, cliente ou senha;
- aba exclusiva para ECOLAB;
- atualizar senha e status: GERADA, ABERTA e LIBERADA;
- usar Supabase como banco ou localStorage como modo DEMO.

## Como testar agora
Abra `index.html` no navegador. A versão DEMO já vem com os registros dos dois relatórios enviados.

## Como ligar ao Supabase
1. Crie um projeto no Supabase.
2. Abra SQL Editor e execute `supabase.sql`.
3. Em `app.js`, preencha:
   `SUPABASE_URL`
   `SUPABASE_ANON_KEY`
4. Publique a pasta em GitHub Pages, Vercel ou Hostinger.

## Observação de segurança
A política do SQL está aberta para facilitar o primeiro teste. Para colocar o painel em produção para terceiros, é recomendável adicionar autenticação e separar permissões de leitura/edição.
