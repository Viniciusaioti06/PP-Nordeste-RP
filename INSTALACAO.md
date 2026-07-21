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


## Atualização 2.0.4

Para um projeto Supabase que já recebeu o `setup.sql` anteriormente, execute:

```text
supabase/upgrade-2.0.4.sql
```

Esse script cria as funções seguras responsáveis por:

- atualizar `profiles.last_login` após cada login;
- gravar ações em `audit_logs`;
- manter a leitura da auditoria restrita às permissões administrativas.

Depois publique os arquivos atualizados no Netlify e limpe o cache do deploy.


## Atualização 2.0.6

Para ativar o botão **Excluir todas as inscrições**, execute no SQL Editor:

```text
supabase/upgrade-2.0.6.sql
```

A exclusão exige duas confirmações no painel, valida as permissões novamente no banco e registra a quantidade removida na auditoria.
