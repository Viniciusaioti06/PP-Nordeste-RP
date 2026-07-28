# Painel 4.0 — Dossiê Institucional

## Principais melhorias

- Nova página de análise em formato de dossiê institucional.
- Identificação completa, status, nota percentual, nível de atenção e tempo no processo.
- Checklist institucional persistente com sete critérios de avaliação.
- Parecer geral do recrutador com salvamento manual.
- Respostas separadas por tipo e filtros rápidos.
- Avaliação qualitativa e observação individual para cada questão aberta.
- Linha do tempo visual do processo seletivo.
- Decisões teórica e física reunidas na página do candidato.
- Remoção da aba isolada de teste físico do painel.
- Confirmação antes de aprovar ou reprovar.
- Aviso de alterações não salvas e proteção ao sair da página.
- Percentual da nota exibido na listagem de candidatos.
- Filtro de candidatos com todos os status do processo.

## Persistência das avaliações

O checklist e as avaliações individuais são salvos dentro de um evento técnico `review_snapshot` no campo JSON `timeline`, que já existe no banco. Assim, esta atualização não exige nova coluna ou migração SQL. Esses eventos técnicos não aparecem na linha do tempo exibida ao recrutador.

## Instalação

Substitua os arquivos do projeto mantendo a estrutura de pastas. Não é necessário executar SQL adicional para esta versão.
