# Conexão com o Supabase — Release 1.1

## 1. Criar as tabelas e políticas

No painel do Supabase:

1. Abra **SQL Editor**.
2. Crie uma nova consulta.
3. Copie todo o conteúdo de `supabase/setup.sql`.
4. Execute a consulta.

## 2. Configurar URL e chave pública

Abra:

```text
supabase/config.js
```

Preencha:

```javascript
const SUPABASE_URL = "https://seu-projeto.supabase.co";
const SUPABASE_ANON_KEY = "sua-publishable-key-ou-anon-key";
```

Use somente a Publishable Key ou `anon public`. Nunca use `service_role` no site.

## 3. Configurar o Supabase Auth

Em **Authentication → Providers → Email**:

- Ative o login por e-mail e senha.
- Para facilitar o primeiro acesso, desative temporariamente a confirmação obrigatória de e-mail, ou confirme o primeiro usuário pelo painel.

Em **Authentication → URL Configuration**, adicione a URL em que o site será publicado.

## 4. Implantar a função de equipe

A criação de recrutadores, supervisores e administradores usa uma Edge Function, porque a chave `service_role` não pode ficar no navegador.

Com o Supabase CLI:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy manage-staff
```

O Supabase fornece automaticamente os secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` para a função hospedada.

## 5. Abrir por servidor

Use Live Server, hospedagem ou outro servidor HTTP. Não abra com `file://`.

## 6. Primeiro administrador

Abra:

```text
painel/login.html
```

Como ainda não existe administrador, o sistema abrirá a configuração inicial.

## Diagnóstico

Abra o console do navegador. Mensagens comuns:

- `Supabase não configurado`: revise `config.js`.
- `relation does not exist`: execute `setup.sql`.
- `row-level security policy`: o SQL não foi executado por completo.
- `Failed to fetch`: confira URL, servidor local e conexão.
- Erro ao adicionar integrante: implante a Edge Function `manage-staff`.
