# Publicar a função manage-staff

Na raiz do projeto:

```bash
npx supabase login
npx supabase link --project-ref https://yfsdexvuzhjcwwnwxyiy.supabase.co/rest/v1/
npx supabase functions deploy manage-staff --no-verify-jwt
```

Depois confira em Supabase > Edge Functions > manage-staff.

Os sublinhados do VS Code desaparecem após instalar a extensão oficial Deno e executar `Developer: Reload Window`. O arquivo `.vscode/settings.json` já está configurado.
