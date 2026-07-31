# Ordenação funcional do questionário

A alça lateral das questões agora permite alterar a sequência real do questionário.

## Funcionamento

- No computador, arraste uma questão pela alça `⋮⋮` e solte antes ou depois de outra questão.
- No celular, tablet ou para maior acessibilidade, use os botões de seta para cima e para baixo.
- A numeração é atualizada imediatamente.
- A nova posição é salva no campo `order_position` da tabela `recruitment_questions` no Supabase.
- O formulário público e o painel passam a carregar as questões na mesma sequência salva.
- Em caso de falha no banco, a lista é recarregada para evitar que uma ordem apenas visual permaneça na tela.
- A alteração é registrada na auditoria quando o serviço de auditoria estiver disponível.

Nenhum SQL adicional é necessário, pois o projeto já possui a coluna `order_position`.
