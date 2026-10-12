# Dois governos em dados

Painel interativo, em português, que compara os governos **Bolsonaro (jan/2019–dez/2022)** e **Lula 3 (desde jan/2023)** com dados públicos oficiais. Usa a mesma série, a mesma métrica e a mesma janela de tempo para os dois. Em cada dado com direção desejável consensual, uma estrela marca o melhor resultado, sem placar geral. O painel também mostra contexto e ressalvas.

- Os números vêm de download registrado: URL, hash SHA-256 e data de coleta de cada arquivo ficam em `data/raw/manifest.jsonl`.
- O mandato em curso é sempre marcado como **parcial**.
- O código e os dados são abertos. Um comando refaz tudo.

## Estrutura

```
etl/                      pipeline em Python
  config/governos.yaml    mandatos e estilo visual de cada governo (constante única)
  config/indicadores.yaml catálogo: metadados, fonte, metodologia e ressalvas
  config/eventos.yaml     eventos de contexto, cada um com fonte oficial
  fontes/                 um coletor por fonte (SIDRA, BCB, IPEADATA, INPE, ANP, TabNet, Sinesp, MDS, FAO, IBGE FTP, INEP)
  indicadores.py          monta a série de cada indicador
  transforma/             atribuição a governos, deflação e resumos
  valida/checks.py        validações automáticas
  run.py                  orquestrador
data/raw/                 brutos por fonte e data (fora do git) + manifest.jsonl (versionado)
data/processed/           catalogo_indicadores.csv, series.csv, resumos_por_governo.csv, eventos_contexto.csv
tests/                    valores conhecidos, estrutura, regras de atribuição, contraste
web/                      site estático (Vite + React + TypeScript + ECharts)
design/                   tokens.json (paleta medida nas artes) e wireframe da Fase 1
docs/                     relatório da Fase 1, metodologia e registro de decisões
```

## Como rodar

Requisitos: Python 3.11 ou mais novo e Node 20 ou mais novo.

```bash
make venv
```

```bash
make data
```

```bash
make test
```

```bash
make web-dev
```

- `make venv` cria o ambiente Python. Se o `python3` do sistema for anterior ao 3.11, indique outro: `make venv PYTHON=python3.13`.
- `make data` baixa as fontes e gera `data/processed`. A primeira execução leva de 20 a 30 minutos e baixa cerca de 830 MB (a maior parte em focos de queimadas, DETER e Sinesp).
- `make test` roda 46 testes: valores conferidos nas fontes, estrutura, regras de atribuição e contraste WCAG.
- `make web-dev` abre o site em modo de desenvolvimento.

Para gerar o site estático em `web/dist`, rode `make web`. Os testes de ponta a ponta (Playwright e axe, no desktop e no celular) rodam com `cd web && npx playwright install chromium && npm run test:e2e`.

### Sem rede

```bash
make data-offline
```

Esse comando refaz `data/processed` só com os brutos já salvos, útil para mexer nas transformações sem baixar nada.

## Como atualizar os dados

1. Rode `make data`. Brutos grandes de períodos já fechados (meses antigos de focos e DETER, anos antigos do Sinesp) são reaproveitados; o resto é baixado de novo.
2. O pipeline falha se alguma validação acusar problema: duplicatas, buracos inesperados, valores fora de faixa plausível, unidade divergente ou governo incoerente com as datas.
3. Rode `make test`. Se um valor conhecido mudar, provavelmente a fonte revisou o dado. Confira na fonte, registre em `docs/DECISOES.md` e atualize o teste.
4. `python scripts/resumo_mudancas.py` lista os períodos novos e os valores revisados em relação ao último commit.

O workflow `.github/workflows/update-data.yml` faz isso toda segunda-feira e abre um PR com esse resumo. O merge é sempre manual.

## Como adicionar um indicador

1. **Metadados.** Acrescente a entrada em `etl/config/indicadores.yaml`: `indicator_id`, tema, nome, unidade, periodicidade, `sentido_desejavel`, fonte, URLs, metodologia, ressalvas, quebra metodológica, `regra_atribuicao` (`centro` ou `fim`), `acumulado` (`composto`, `soma` ou vazio) e `metrica_padrao`.
2. **Coleta.** Escreva em `etl/indicadores.py` uma função com `@indicador("seu_id")` que devolva `periodo`, `data_inicio`, `data_fim` e `valor` (e, se for o caso, `parcial`, `entra_no_resumo`, `qualificador` e `observacao`). Use os coletores de `etl/fontes/`; todo download precisa passar por `etl.comum.obter()`, que salva o bruto e registra o manifesto.
3. **Validação.** Acrescente a faixa plausível em `etl/valida/checks.py` (`FAIXAS`) e, se houver lacunas conhecidas na fonte, em `LACUNAS_CONHECIDAS`.
4. **Teste.** Acrescente ao menos um valor conferido na fonte em `tests/test_valores_conhecidos.py`.
5. Rode `make data && make test`. O site lê o catálogo e passa a mostrar o indicador sozinho.

## Como adicionar outro governo

Acrescente o mandato em `etl/config/governos.yaml` (id, nome, início, fim e estilo: cor, traço, marcador) e ajuste `comparacao_padrao` se ele deve entrar na comparação. A atribuição, os resumos e o site leem essa configuração, sem outra mudança de código.

O site hoje compara dois governos (A e B) por vez. Mostrar três ou mais lado a lado exigiria adaptar o cartão e a imagem exportada.

## Publicação

O site é publicado na Vercel a partir de `vercel.json`, na raiz: instala e compila `web/`, que lê `data/processed`, e serve `web/dist`. Cada push em `main` publica de novo. Não há backend nem variáveis de ambiente; o Python roda só na coleta (`make data` ou o workflow semanal).

- `.github/workflows/ci.yml` roda os testes Python, o build e os testes de ponta a ponta.
- `.github/workflows/update-data.yml` atualiza os dados toda semana e abre um PR; ao fazer o merge, a Vercel publica.

Repositório: <https://github.com/AmorimTorres/comparativo_governos>. Mantido por André Amorim Torres - Dreds (amorimtorresandre@gmail.com); para mudar, edite a constante `MANTENEDOR` em `web/src/paginas/Metodologia.tsx`.

## Documentação

- [docs/METODOLOGIA.md](docs/METODOLOGIA.md): regras de atribuição, métricas, validações e limitações.
- [docs/DECISOES.md](docs/DECISOES.md): decisões e pendências.
- [docs/fase1_relatorio.md](docs/fase1_relatorio.md): descoberta das fontes, ranking de indicadores e teste de sanidade com os cartões de referência.
