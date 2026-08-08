# Reparo 4.4 — análise de candidatos

Este pacote corrige problemas que podem deixar o dossiê sem respostas e impedir decisões.

## O que foi corrigido

- Dossiê do candidato passa a carregar a inscrição diretamente pelo ID.
- Respostas são normalizadas de forma compatível com formatos antigos.
- O `question_snapshot` é usado como fonte complementar, então as perguntas continuam aparecendo mesmo quando o JSON de respostas estiver incompleto.
- Tratamento defensivo de status, timeline e elementos da página.
- Aprovação/reprovação mantém as permissões específicas e exibe erro claro quando elas não existem.
- Perfis antigos recebem as permissões novas sem apagar permissões já existentes.
- `automatic_score` passa a aceitar casas decimais no banco.
- Função de submissão mantém Discord/passaporte antifraude e não converte a nota decimal para inteiro.
- Edge Function `manage-staff` foi corrigida para usar `callerProfile`, `user.id` e `admin` corretamente na manutenção.

## Banco de dados

Execute uma vez:

`supabase/upgrade-4.4-reparo-processo.sql`

O script não exclui inscrições nem respostas.

## Edge Function

Publique novamente:

`supabase functions deploy manage-staff`

Depois publique o site normalmente.
