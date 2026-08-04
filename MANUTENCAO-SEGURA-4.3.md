# Manutenção segura 4.3

O botão **Excluir todas as inscrições** agora usa uma Edge Function protegida.

## 1. Atualizar o banco

Execute no SQL Editor:

```text
supabase/upgrade-4.3-manutencao-segura.sql
```

## 2. Publicar a Edge Function

### Pelo Supabase CLI

No terminal, dentro da pasta do projeto:

```bash
npx supabase login
npx supabase link --project-ref yfsdexvuzhjcwwnwxyiy
npx supabase functions deploy clear-applications
```

A função utiliza automaticamente:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Esses secrets já são disponibilizados no ambiente das Edge Functions do Supabase.

### Pelo painel do Supabase

Também é possível criar uma função chamada:

```text
clear-applications
```

e copiar o conteúdo de:

```text
supabase/functions/clear-applications/index.ts
```

## 3. Publicar o site

Depois, publique o projeto atualizado no Netlify com limpeza de cache.

## Proteções aplicadas

- Somente cargo `admin`.
- Exige as permissões `settings_manage` e `applications_delete`.
- Valida a sessão no servidor.
- Exige a frase `EXCLUIR TODAS`.
- O navegador não possui acesso direto à função SQL.
- Inscrições e identidades antifraude são removidas na mesma transação.
- A quantidade removida fica registrada na auditoria.
