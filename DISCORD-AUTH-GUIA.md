# Configuração do login com Discord

## 1. Criar a aplicação no Discord

1. Acesse o Discord Developer Portal.
2. Crie uma aplicação.
3. Abra **OAuth2**.
4. Copie o **Client ID** e gere/copiei o **Client Secret**.
5. Em **Redirects**, adicione:

```text
https://yfsdexvuzhjcwwnwxyiy.supabase.co/auth/v1/callback
```

## 2. Ativar o Discord no Supabase

No projeto Supabase:

```text
Authentication
→ Sign In / Providers
→ Discord
```

Ative o provedor e informe o Client ID e Client Secret da aplicação.

## 3. Configurar URLs permitidas

No Supabase:

```text
Authentication
→ URL Configuration
```

Configure a URL principal do Netlify como **Site URL** e adicione em **Redirect URLs**:

```text
https://penal-nrp.netlify.app/recrutamento.html
https://penal-nrp.netlify.app/**
http://localhost:*/recrutamento.html
```

Caso o domínio publicado seja diferente, substitua `penal-nrp.netlify.app`.

## 4. Atualizar o banco

Execute no SQL Editor:

```text
supabase/upgrade-discord-antifraude.sql
```

## Resultado

- O formulário só abre após autenticação com Discord.
- O site não recebe a senha do Discord.
- Cada conta do Discord só pode enviar uma inscrição.
- Cada passaporte só pode ser usado uma vez.
- A validação ocorre no banco, não apenas no navegador.
- Contas de candidatos não recebem acesso ao painel interno.
