# Manutenção segura 4.4

A limpeza geral foi centralizada na Edge Function `manage-staff`.

## Para atualizar

1. Caso ainda não tenha executado:

```text
supabase/upgrade-4.3-manutencao-segura.sql
```

2. Publique novamente a função:

```bash
npx supabase functions deploy manage-staff
```

Ou substitua o código da função pelo arquivo:

```text
supabase/functions/manage-staff/index.ts
```

3. Publique o site no Netlify com limpeza de cache.

O painel agora envia:

```json
{
  "action": "clearApplications",
  "payload": {
    "confirmation": "EXCLUIR TODAS"
  }
}
```
