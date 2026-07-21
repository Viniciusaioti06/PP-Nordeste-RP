# Instalação — Release 2.0

## 1. Banco

Execute `supabase/setup.sql` no SQL Editor do Supabase.

## 2. Configuração pública

Abra `supabase/config.js` e preencha:

```javascript
window.APP_CONFIG = Object.freeze({
  SUPABASE_URL: "https://SEU_PROJECT_REF.supabase.co",
  SUPABASE_ANON_KEY: "SUA_PUBLISHABLE_OU_ANON_KEY"
});
```

Nunca coloque a `service_role` no site.

## 3. Project Ref

Abra `supabase/config.toml` e substitua:

```toml
project_id = "COLE_AQUI_O_PROJECT_REF"
```

## 4. Edge Function

No terminal, dentro da pasta do projeto:

```bash
npx supabase login
npx supabase link --project-ref yfsdexvuzhjcwwnwxyiy
npx supabase functions deploy manage-staff
```

## 5. Primeiro administrador

Abra `painel/login.html`. O sistema redirecionará para a configuração inicial quando ainda não existir administrador.

## 6. VS Code

Instale a extensão oficial Deno. O projeto contém:

- `.vscode/settings.json`
- `supabase/functions/manage-staff/deno.json`
