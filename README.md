# Sistema Oficial de Recrutamento — Polícia Penal Ceará

## Release 1.0

Portal oficial para gerenciamento do processo seletivo da Polícia Penal Ceará no GTA RP.

## Cargos

### Administrador
Acesso completo ao sistema, equipe, permissões, configurações, auditoria, avisos e questionário.

### Supervisor
Acesso à análise de candidatos, teste físico, questionário, avisos e auditoria. Não gerencia a equipe nem as configurações gerais por padrão.

### Recrutador
Acesso operacional aos candidatos, avaliações e teste físico conforme as permissões concedidas.

## Primeiro acesso
Ao abrir `painel/login.html` pela primeira vez, o sistema direciona para a criação do administrador principal.

## Segurança
Para implantação pública definitiva, conectar ao Supabase Auth e aplicar políticas RLS.
