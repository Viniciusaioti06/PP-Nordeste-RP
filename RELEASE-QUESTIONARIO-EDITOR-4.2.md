# Questionário 4.2 — Editor simplificado e nota mínima 7/10

- Modal reorganizado em etapas claras.
- Campos mudam conforme o tipo da questão.
- Questões abertas não exibem nem salvam pontuação.
- Questões eliminatórias exibem somente controles de eliminação.
- Questões objetivas continuam com pesos e pontos por alternativa.
- A nota objetiva agora é normalizada automaticamente para uma escala de 0 a 10.
- Configuração da nota mínima aceita valores de 0 a 10 e foi preparada para 7/10.
- Salvamento da regra recebe validação, retorno visual e confirmação do valor persistido.

## Banco existente
Execute `supabase/upgrade-4.2-nota-minima.sql` para definir 7 como padrão e restringir a nota ao intervalo de 0 a 10.
