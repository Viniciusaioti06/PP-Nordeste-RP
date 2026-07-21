# Instalação — Release 2.0.1

A conexão pública já está configurada para o projeto:

```text
https://yfsdexvuzhjcwwnwxyiy.supabase.co
```

## Ordem correta

1. Execute `supabase/setup.sql` no SQL Editor.
2. Publique os arquivos no Netlify.
3. Abra `/diagnostico-supabase.html`.
4. Se a conexão for confirmada, abra `/painel/login.html`.
5. A Edge Function `manage-staff` continua sendo usada somente para gerenciar usuários da equipe.

## Importante

O `createClient` recebe a URL-base do projeto, sem `/rest/v1`.
O caminho `/rest/v1` é adicionado internamente pela biblioteca.
