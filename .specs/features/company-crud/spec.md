# Cadastro da Empresa - Specification

## Problem Statement

O usuario precisa cadastrar os dados da sua empresa (PJ brasileira) para que essas informacoes aparecam nos invoices gerados pelo sistema. Sem a empresa cadastrada, o invoice nao tem remetente — dados como razao social, CNPJ, endereco e dados bancarios sao obrigatorios no documento.

## Goals

- [ ] Permitir que o usuario cadastre e edite os dados da sua empresa
- [ ] Armazenar dados bancarios para pagamento via wire transfer (IBAN/SWIFT)
- [ ] Fornecer os dados da empresa para geracao de invoices (M2)

## Out of Scope

| Feature | Reason |
| --- | --- |
| Multi-empresa por usuario | Future consideration — v1 e 1:1 |
| Consulta automatica CNPJ (ReceitaWS) | Complexidade desnecessaria no v1 |
| Upload de logo da empresa | Nao aparece no template de invoice atual |
| Validacao de IBAN/SWIFT | Complexidade desproporcional — texto livre no v1 |
| Onboarding obrigatorio | Cadastro e opcional/adiavel (Opcao C) |

---

## User Stories

### P1: Cadastrar dados da empresa ⭐ MVP

**User Story**: Como usuario, quero cadastrar os dados da minha empresa para que aparecam corretamente nos invoices que eu gerar.

**Why P1**: Sem empresa cadastrada, nao ha como gerar invoices — e o core do app.

**Acceptance Criteria**:

1. WHEN usuario acessa a pagina de empresa sem ter empresa cadastrada THEN sistema SHALL exibir estado vazio com opcao de cadastrar
2. WHEN usuario clica em cadastrar e preenche os campos obrigatorios e submete THEN sistema SHALL salvar a empresa e exibir os dados cadastrados
3. WHEN usuario submete com CNPJ invalido (digitos verificadores) THEN sistema SHALL exibir erro de validacao inline
4. WHEN usuario submete com CNPJ sem mascara THEN sistema SHALL aceitar e formatar automaticamente (XX.XXX.XXX/XXXX-XX)
5. WHEN usuario submete sem preencher campos obrigatorios THEN sistema SHALL exibir erro de validacao por campo

**Campos obrigatorios:**

| Campo | Tipo | Validacao |
| --- | --- | --- |
| Razao social | texto (max 200) | required |
| CNPJ | texto (14 digitos) | required, algoritmo digitos verificadores, unico |
| Regime tributario | enum | required (MEI, EI, ME, SLU, LTDA) |
| Email | texto | required, formato email |
| Telefone | texto | required, formato telefone BR |
| Endereco: rua | texto (max 200) | required |
| Endereco: numero | texto (max 20) | required |
| Endereco: complemento | texto (max 100) | opcional |
| Endereco: CEP | texto (8 digitos) | required, formato XXXXX-XXX |
| Endereco: cidade | texto (max 100) | required |
| Endereco: estado | enum (UFs) | required |
| Endereco: pais | texto | required, default "Brazil" |

**Independent Test**: Criar empresa com dados validos, ver dados salvos na tela.

---

### P1: Cadastrar dados bancarios ⭐ MVP

**User Story**: Como usuario, quero cadastrar os dados bancarios da minha empresa para que aparecam na secao de pagamento dos invoices.

**Why P1**: O invoice precisa dos dados bancarios para que o cliente saiba como pagar.

**Acceptance Criteria**:

1. WHEN usuario preenche os dados bancarios no formulario da empresa THEN sistema SHALL salvar junto com os demais dados
2. WHEN usuario deixa dados bancarios em branco THEN sistema SHALL aceitar (dados bancarios sao opcionais no cadastro, obrigatorios apenas na geracao do invoice)

**Campos bancarios (todos opcionais no cadastro):**

| Campo | Tipo | Notas |
| --- | --- | --- |
| Nome do beneficiario | texto (max 200) | Nome/razao social na conta |
| Nome do banco | texto (max 100) | Ex: "BANCO OURINVEST S.A" |
| Tipo da conta | enum | Corrente, Poupanca, Company Account |
| Numero da conta (IBAN) | texto (max 50) | Formato IBAN brasileiro (BR + 23 chars) |
| Codigo SWIFT/BIC | texto (max 11) | 8 ou 11 caracteres alfanumericos |

**Independent Test**: Criar empresa com dados bancarios, verificar que foram salvos.

---

### P1: Editar dados da empresa ⭐ MVP

**User Story**: Como usuario, quero editar os dados da minha empresa quando houver mudancas (migracao de regime, troca de banco, mudanca de endereco).

**Why P1**: Dados mudam — sem edicao, o user fica preso a dados errados nos invoices.

**Acceptance Criteria**:

1. WHEN usuario acessa a pagina de empresa com empresa cadastrada THEN sistema SHALL exibir os dados atuais com opcao de editar
2. WHEN usuario altera campos e salva THEN sistema SHALL atualizar os dados e exibir confirmacao
3. WHEN usuario altera CNPJ para valor invalido THEN sistema SHALL exibir erro de validacao (mesmas regras da criacao)
4. WHEN usuario tenta salvar sem campos obrigatorios THEN sistema SHALL exibir erros inline

**Independent Test**: Editar razao social e CNPJ, verificar que os novos dados aparecem.

---

### P2: Visualizar dados da empresa

**User Story**: Como usuario, quero ver os dados cadastrados da minha empresa de forma organizada, separando dados gerais dos dados bancarios.

**Why P2**: UX — ver os dados sem entrar em modo edicao. Nao bloqueia funcionalidade.

**Acceptance Criteria**:

1. WHEN usuario acessa a pagina de empresa THEN sistema SHALL exibir dados em modo leitura com CNPJ formatado e endereco completo
2. WHEN empresa nao tem dados bancarios cadastrados THEN sistema SHALL exibir secao bancaria com indicacao de "nao cadastrado"

**Independent Test**: Acessar pagina com empresa cadastrada, ver dados formatados.

---

## Edge Cases

- WHEN usuario tenta cadastrar segunda empresa THEN sistema SHALL bloquear (1:1 no v1)
- WHEN CNPJ ja existe para outro usuario THEN sistema SHALL exibir erro "CNPJ ja cadastrado"
- WHEN usuario nao esta autenticado e acessa /empresa THEN sistema SHALL redirecionar para login
- WHEN usuario edita empresa e perde conexao THEN sistema SHALL exibir erro generico e manter dados do formulario
- WHEN campo CEP e preenchido sem mascara THEN sistema SHALL aceitar e formatar (XXXXX-XXX)

---

## Requirement Traceability

| Requirement ID | Story | Description | Status |
| --- | --- | --- | --- |
| COMP-01 | P1: Cadastrar empresa | Formulario de criacao com campos obrigatorios | Pending |
| COMP-02 | P1: Cadastrar empresa | Validacao CNPJ (algoritmo digitos verificadores) | Pending |
| COMP-03 | P1: Cadastrar empresa | Formatacao automatica CNPJ e CEP | Pending |
| COMP-04 | P1: Cadastrar empresa | Regime tributario como enum (MEI, EI, ME, SLU, LTDA) | Pending |
| COMP-05 | P1: Dados bancarios | Campos bancarios opcionais (beneficiario, banco, tipo, IBAN, SWIFT) | Pending |
| COMP-06 | P1: Editar empresa | Edicao de todos os campos sem restricao | Pending |
| COMP-07 | P1: Editar empresa | Mesmas validacoes da criacao aplicadas na edicao | Pending |
| COMP-08 | P2: Visualizar empresa | Tela de leitura com dados formatados | Pending |
| COMP-09 | Edge | Bloquear criacao de segunda empresa (1:1) | Pending |
| COMP-10 | Edge | CNPJ unico por usuario | Pending |

**Coverage:** 10 total, 0 mapped to tasks, 10 unmapped

---

## Success Criteria

- [ ] Usuario consegue cadastrar empresa com todos os campos do invoice template
- [ ] CNPJ validado com algoritmo de digitos verificadores
- [ ] Dados bancarios salvos e disponiveis para geracao de invoice (M2)
- [ ] Todos os dados editaveis a qualquer momento
- [ ] Relacao 1:1 usuario-empresa enforced
