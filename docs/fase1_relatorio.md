# Fase 1: relatório de descoberta e plano do painel comparativo 2019–2026

## Contexto

O objetivo é um painel público, em pt-BR, que compare os governos Bolsonaro (jan/2019–dez/2022) e Lula 3 (jan/2023–hoje) só com dados oficiais e reprodutíveis, sem veredito e com o contexto de cada período. A pasta `/Users/dreds/pirinhas/comparativo_lula_bozo` hoje só tem `referencias/` (6 cartões de dados e 3 artes de identidade). Esta fase testou de verdade cada fonte candidata (API ou download, em 11/10/2026), reproduziu os números dos cartões e definiu o plano. Relatório aprovado em 11/10/2026 e salvo aqui sem alterações de conteúdo.

**Observação:** a pasta das artes se chama `referencias/id_visual/`, e não `referencias/identidade/`.

---

## 1. Resumo dos achados

- **Nenhum domínio bloqueado** exigiu download manual. Todas as fontes do núcleo responderam por API ou arquivo.
- **Seis dos dez números dos cartões batem exatamente** com as fontes oficiais. Os outros quatro têm problemas:
  - O PIB do governo Lula (2,8%) não é reproduzível.
  - O desemprego de 14,7% não é o recorde da série atual, que é 14,9%.
  - O "33,1 milhões passando fome" não é da FAO: vem da Rede PENSSAN, uma pesquisa não governamental.
  - O "fora do Mapa da Fome" depende da edição da FAO, que revisa a série inteira a cada ano.
- **Vacinação não é comparável.** O sistema mudou exatamente na troca de governo (TabNet até 2022, painel RNDS desde 2023).
- **Segurança alimentar do IBGE (EBIA) não tem dado em 2019–2022.** Só há POF 2017–18 e PNAD Contínua 2023 e 2024.
- **A paleta medida nas artes difere da aproximada no briefing.** O âmbar sugerido (#C98F00) reprova contraste sobre fundo claro (2,6:1), por isso proponho escurecê-lo (seção 7).

## 2. Acesso às fontes (testado em 11/10/2026)

| Fonte | Acesso | Situação |
|---|---|---|
| IBGE SIDRA (`apisidra.ibge.gov.br`) e agregados v3 | API JSON | OK. Último dado: PNAD jun–ago/2026, CNT 2026T2, IPCA set/2026 |
| IBGE FTP (SIS 2025, Projeção da População rev. 2024) | ODS/XLSX | OK (ODS lido só com a biblioteca padrão) |
| BCB SGS (`api.bcb.gov.br`) | API JSON | OK (3–4 s por chamada) |
| IPEADATA OData4 | API | OK, mas lenta (10 s ou mais). `ValoresSerie` funciona e os filtros de `Metadados` falham |
| INPE TerraBrasilis: taxas PRODES | JSON `app/prodes/dashboard/deforestation/files/rates2025.json` | OK. O nome do arquivo muda por ano e vem da constante `FILE_RATES` do bundle JS do dashboard |
| INPE PRODES Cerrado | JSON `files/data/prodes_cerrado.json` | OK |
| INPE DETER (WFS `deter-amz:deter_amz`) | WFS com filtro CQL por mês | OK. São 461.771 polígonos, atualizados em 02/10/2026 |
| INPE Queimadas (`dataserver-coids.inpe.br`) | CSV/ZIP | OK. Série anual do satélite de referência 2003–2025; mensal de 2026 com todos os satélites, filtrando `AQUA_M-T` |
| ANP: série histórica de preços | XLSX mensal Brasil desde 2013 | OK até set/2026. Sem coleta entre 18/8 e 17/10/2020 |
| MTE PDET (FTP Novo CAGED) | 7z, cerca de 50 MB por mês | OK no FTP (2020–ago/2026). O site `pdet.mte.gov.br` não respondeu |
| DATASUS FTP (SIM, SINASC) e TabNet | DBC / HTML | OK. Dados definitivos até 2024; preliminares de 2025 e 2026. `https://ftp.datasus...` não funciona, usar `ftp://` |
| API de dados abertos do MS | REST | OK, mas sem cobertura vacinal (só doses aplicadas) |
| FAOSTAT bulk (Food Security) | ZIP | OK (edição SOFI 2026, de 21/07/2026). A API da FAOSTAT exige token (401) |
| MDS/SAGI MI Social (Solr) | API JSON | OK. Dados municipais mensais; soma nacional via `stats` |
| MJSP Sinesp VDE (`bancovde-AAAA.xlsx`) | XLSX anual | OK, 2015 a ago/2026. `dados.mj.gov.br` não resolve DNS |
| INEP (`download.inep.gov.br`) | ZIP | OK via curl. Python `requests` levou *connection reset* (TLS), então usar curl ou httpx com HTTP/1.1 |
| Tesouro Transparente CKAN (COFOG) | CSV | OK, 2010–2024 |
| ComexStat (MDIC) | API | OK |
| dados.gov.br API | API | 401 (exige token). Não é necessária para o núcleo |

## 3. Ranking: 25 indicadores recomendados

Os indicadores estão ordenados por qualidade do dado × apelo popular. **Sentido** indica se o cartão pode ter seta (só quando a direção é consensual); "neutro" fica sem seta.

| # | Indicador | Fonte e série verificada | Cobertura | Ressalvas principais | Sentido |
|---|---|---|---|---|---|
| 1 | Desemprego (taxa de desocupação) | IBGE PNAD C, SIDRA 6381 v4099 (mensal, trimestre móvel) e 4099 (trimestral) | mar/2012–ago/2026 | Reponderação em 2021; trimestre móvel cruza a troca de governo | menor_melhor |
| 2 | Inflação, IPCA (mensal, 12 meses, acumulado no mandato) | SIDRA 1737 v63/2265/2266; espelho BCB 433/13522 | 1979–set/2026 | Nenhuma | menor_melhor |
| 3 | PIB (anual e trimestral) | IBGE CNT, SIDRA 5932 v6563 (4º trimestre = ano), v6564, v6561 | 1996T1–2026T2 | 2026 só tem o 1º semestre (parcial). Revisões a cada divulgação: guardar a versão | maior_melhor |
| 4 | Desmatamento na Amazônia Legal (PRODES) | INPE, `rates*.json` (taxa anual oficial) | 1988–2025 | O ano PRODES vai de agosto a julho. PRODES 2026 sai por volta de nov/2026 | menor_melhor |
| 5 | Rendimento médio real do trabalho | SIDRA 5436 v5933 (habitual, todos os trabalhos) | 2012T1–2026T2 | A preços do último trimestre | maior_melhor |
| 6 | Inflação de alimentos e bebidas | IPCA grupo 1: SIDRA 1419 (até 2019) + 7060 (desde 2020), c315=7170; espelho BCB 1635 | 2012–set/2026 | Pesos da POF mudaram em jan/2020 (o grupo é o mesmo e a série encadeia) | menor_melhor |
| 7 | Saldo de empregos formais (Novo CAGED) | MTE; distribuição pelo IPEADATA `CAGED12_SALDON12`; validação nos microdados do FTP PDET | jan/2020–ago/2026 | **Quebra:** 2019 é do CAGED antigo (`CAGED12_SALDO12`) e aparece à parte. Série "sem ajuste" | maior_melhor |
| 8 | Salário mínimo real | Nominal: BCB 1619. Real: deflacionado pelo INPC (SIDRA 1736). Conferência: IPEADATA `GAC12_SALMINRE12` | 1940–set/2026 | Variável de política. A BCB 1619 já traz os meses futuros de 2026 por decreto, então cortar no mês corrente | neutro |
| 9 | Extrema pobreza (abaixo de US$ 2,15/dia PPC 2017) | IBGE SIS 2025, Tabela 2.17 (FTP, ODS) | 2012–2024 | Lula tem só 2 anos (2025 sai na SIS 2026, por volta de dez/2026) | menor_melhor |
| 10 | Pobreza (abaixo de US$ 6,85/dia PPC 2017) | Mesma fonte | 2012–2024 | Mesmas ressalvas | menor_melhor |
| 11 | Subalimentação, o "Mapa da Fome" (PoU, FAO) | FAOSTAT `Food_Security_Data_E_All_Data_(Normalized)` | triênios até 2023–25 | Médias trienais. "<2,5%" não tem valor exato. A FAO revisa a série inteira a cada edição | menor_melhor |
| 12 | Insegurança alimentar grave (FIES, FAO) | Mesma fonte | triênios 2014–16 a 2023–25 | **Métrica diferente da PoU**: separar e rotular | menor_melhor |
| 13 | Homicídios por 100 mil habitantes | SIM (CID-10 X85–Y09 + Y35–Y36), dividido pela Projeção da População IBGE rev. 2024 | 1996–2024 definitivo; 2025 preliminar | Defasagem; marcar o preliminar | menor_melhor |
| 14 | Preço real da gasolina comum | ANP mensal Brasil, deflacionado pelo IPCA | jan/2013–set/2026 | Lacuna em 2020. Depende do petróleo e de tributos | neutro |
| 15 | Preço real do botijão (GLP 13 kg) | ANP | jan/2013–set/2026 | Mesmas ressalvas | neutro |
| 16 | Bolsa Família / Auxílio Brasil: famílias e benefício médio real | MDS MI Social (`qtd_familias_beneficiarias_bolsa_familia_i`, `pab_qtd_fam_benef_i`, valores) | 2019–ago/2026 verificados | O programa trocou de nome (PBF, depois AB em nov/2021, de novo PBF em mar/2023). Entre abr/2020 e out/2021 o valor foi pago via Auxílio Emergencial | neutro |
| 17 | Desigualdade de renda (Gini) | SIDRA 7435 | 2012–2025 | Nenhuma | menor_melhor |
| 18 | Informalidade | SIDRA 8529 (trimestral) e 4708 (anual) | 2015T4–2026T2 | Série começa só em 2015 | menor_melhor |
| 19 | Desmatamento no Cerrado (PRODES) | INPE `prodes_cerrado.json` (incrementos mapeados) | anual nos anos recentes até 2025 | Ano de agosto a julho | menor_melhor |
| 20 | Focos de queimadas (satélite de referência) | INPE BDQueimadas | 2003–2025, mais 2026 mensal | Forte efeito do clima (secas, El Niño) | menor_melhor |
| 21 | Mortalidade infantil (por mil nascidos vivos) | SIM + SINASC (FTP) | 1996–2024; 2025 preliminar | Cálculo direto, sem correção de subnotificação | menor_melhor |
| 22 | Feminicídios | Sinesp VDE | 2015–ago/2026 | Qualidade varia por UF; a classificação melhorou com o tempo | menor_melhor |
| 23 | Latrocínios | Sinesp VDE | 2015–ago/2026 | Qualidade varia por UF | menor_melhor |
| 24 | IDEB (anos iniciais, anos finais e ensino médio) | INEP, `divulgacao_brasil_ideb_2025.zip` (2005–2025) | bienal: 2019 e 2021 × 2023 e 2025 | 2021 afetado pela pandemia | maior_melhor |
| 25 | Juros básicos (Selic meta) | BCB 432 | 1999–hoje | O Banco Central é autônomo desde 2021: o juro não é decisão do Executivo | neutro |

**Reserva:** verificados, mas fora do núcleo; entram se houver espaço.
- Diesel (ANP).
- DETER mensal, que é série complementar ao PRODES e permite atribuir cada mês exatamente.
- Câmbio (BCB 3698).
- Endividamento das famílias (BCB 29037).
- Inadimplência de pessoa física (BCB 21084).
- Dívida bruta do governo geral/PIB (BCB 13762, metodologia pós-2008).
- Resultado primário em 12 meses, % do PIB (BCB 5793; positivo = déficit).
- Balança comercial (BCB 22707 ou ComexStat).
- Roubo de veículos (Sinesp).
- Analfabetismo 15+ (SIDRA 7113; **sem 2020–21**).
- Abandono escolar (INEP `tx_rend_brasil_regioes_ufs_AAAA.zip`, 2019–2025).
- Gasto federal em saúde (COFOG 2010–2024).

**Camada de contexto, sem comparação de desempenho:** óbitos por COVID-19 (SIM, U07.1/U07.2).

## 4. Descartados

1. **Cobertura vacinal (PNI).** O TabNet SI-PNI cobre 2000–2022; de 2023 em diante só existe o painel RNDS, com outra base e outros denominadores. A quebra coincide com a troca de governo, e a API do MS só traz doses aplicadas. Reavaliar se o MS publicar uma série harmonizada.
2. **Segurança alimentar do IBGE (EBIA).** Não há dado oficial em 2019–2022 (POF 2017–18; PNAD C 2023 e 2024, SIDRA 9552). Entra só como nota na página de fome.
3. **Rede PENSSAN/VIGISAN.** Pesquisa não governamental: só pode ser citada como complementar e sinalizada, como o FBSP.
4. **Indicador Criança Alfabetizada.** Foi criado em 2023 e não tem equivalente anterior.
5. **Farmácia Popular.** Não há série oficial aberta localizada: a API do dados.gov.br exige token e a API do MS não cobre o programa. Reavalio se você tiver o arquivo.
6. **Minha Casa Minha Vida.** Foi substituído pelo Casa Verde e Amarela (2021–22), com outras modalidades, e não há série contínua oficial.
7. **Anuário do FBSP e Atlas da Violência.** Ficam só como referência cruzada sinalizada, porque não são fonte governamental primária.
8. **Taxa de mortalidade infantil das projeções do IBGE.** É estimativa de modelo; o painel usa o cálculo direto SIM/SINASC.

## 5. Teste de sanidade com os cartões de referência

| Cartão | Número | Reproduziu? | Série e período exatos | Tipo de valor e observação |
|---|---|---|---|---|
| Economia, Bolsonaro | 1,4% | **Sim** | SIDRA 5932 v6563 no 4º trimestre: 2019 = 1,2; 2020 = −3,3; 2021 = 4,8; 2022 = 3,0. Média aritmética 1,43% (geométrica 1,38%) | Média do mandato (justo) |
| Economia, Lula | 2,8% | **Não** | 2023 = 3,2; 2024 = 3,4; 2025 = 2,3, média de **3,0%** (3 anos completos). Com 2026 parcial (acumulado no ano até o 2º trimestre: 1,9%), a média dá **2,7%** | Para dar 2,8%, 2026 teria de ser cerca de 2,3%. Provavelmente usa projeção sem rótulo. O cartão diz "2023 a 2026", mas 2026 está incompleto |
| Inflação, Bolsonaro | 10,06% | **Sim** | IPCA de dez/2021 em 12 meses (SIDRA 1737 v2265) | **Pico** (pior ano) |
| Inflação, Bolsonaro, acumulado | 26,93% | **Sim** | jan/2019–dez/2022 (48 meses) | Acumulado do mandato |
| Inflação, Lula | 4,22% | **Sim** | 12 meses até **ago/2026** | **Ponto atual**, e não ano fechado. Com set/2026 já é 4,58% |
| Inflação, Lula, acumulado | 17,90% | **Sim** | jan/2023–ago/2026 (44 meses) | Com set/2026: 18,87% (45 meses). Na mesma janela de 45 meses, Bolsonaro acumulou **24,89%**. O cartão compara o pico de um com o ponto atual do outro |
| Desemprego, Bolsonaro | 14,7% | **Parcial** | Na série atual, 14,7% é mar–mai/2021. O **recorde da série atual é 14,9%** (jul–set/2020 e jan–mar/2021) | **Pico.** Pode ser o valor divulgado na época, antes da reponderação de 2021; o SIDRA só guarda a versão vigente, então não dá para confirmar |
| Desemprego, Lula | 5,3% | **Sim** | jun–ago/2026 (último dado) | **Ponto final.** Na comparação justa: média dos meses 1–44, **12,5% × 6,7%**; no mesmo mês 44, **8,9% × 5,3%** |
| Desemprego, mínimo | 5,1% | **Sim** | out–dez/2025, o mínimo da série (desde 2012) | Vale |
| Desmatamento, Bolsonaro | 13.038 km² | **Sim** | PRODES 2021 (ago/2020–jul/2021). Maior desde 2006 (14.286), o que confirma os "15 anos" | **Pico** |
| Desmatamento, Lula | 5.731 km² | **Sim** | PRODES 2025 (ago/2024–jul/2025). Menor desde 2014 (5.012) | **Vale/ponto final.** Na comparação justa: média 2019–22 = 11.403 × 2023–25 = 7.104 (parcial). O PRODES 2023 tem 5 meses ainda do governo anterior |
| Fome: "fora do Mapa da Fome, <2,5%" | — | **Sim, com ressalva** | FAO PoU. A SOFI 2025 publicou o triênio 2022–24 abaixo de 2,5%. **A edição atual (SOFI 2026) revisou 2022–24 para 2,7%** e põe 2023–25 abaixo de 2,5% | Média trienal; o triênio 2022–24 inclui 2022. É preciso fixar a edição usada |
| Fome: "33,1 milhões" | — | **Fonte errada** | 33,1 mi é do **II VIGISAN da Rede PENSSAN** (campo de nov/2021 a abr/2022, escala EBIA), pesquisa não governamental. A FAO (FIES) dá **17,9 mi** em insegurança alimentar grave em 2020–22 (8,5%) e 46,2 mi em moderada ou grave | Pontual (pesquisa) |

**Por que os dois cartões de fome não se comparam:**
- A **PoU** é a subalimentação calórica estimada por modelo a partir da disponibilidade de alimentos. É ela que define o "Mapa da Fome".
- A **insegurança alimentar grave** vem de uma escala de experiência respondida pelas famílias (FIES na FAO, EBIA no IBGE e na PENSSAN).

São fenômenos e métodos diferentes, então "<2,5%" e "33,1 milhões" não podem ser postos lado a lado.

## 6. Regras de atribuição por governo

Os mandatos ficam em `etl/config/governos.yaml` (id, nome, início, fim, cor, traço, marcador). Para incluir Lula 1 e 2, Dilma ou Temer, basta acrescentar uma entrada.

- **Mensal:** o mês vai para quem governou naquele mês (jan/2023 = Lula, mês 1). `mes_do_mandato` vai de 1 a 48.
- **Trimestre móvel (PNAD):** atribuído pelo **mês final**, que é a convenção do IBGE. Os 2 primeiros de cada mandato são marcados como `transição`.
- **Trimestre civil e ano civil:** atribuição direta. Em dado anual, `mes_do_mandato` fica vazio e `ano_do_mandato` vai de 1 a 4.
- **Acumulados em 12 meses (IPCA 12m, primário 12m):** nos 11 primeiros meses de cada mandato eles contêm meses do governo anterior e são marcados. Os resumos do mandato usam as variações mensais acumuladas **dentro** do mandato.
- **PRODES (agosto a julho):** o ano PRODES Y vai para o governo com 7 ou mais dos 12 meses, ou seja, o que estava no poder em janeiro de Y. Assim 2019–22 = Bolsonaro e 2023–26 = Lula. PRODES 2019 e 2023 ficam marcados como "transição (5 meses do governo anterior)", e o DETER mensal serve de checagem.
- **Triênios da FAO:** vão para o governo com 2 ou mais dos 3 anos. Os triênios mistos são marcados.
- **IDEB:** atribuído pelo ano de aplicação.
- **Janela comum:** os resumos trazem também a comparação só nos meses (ou anos) que existem nos dois mandatos. Proponho 3 colunas extras em `resumos_por_governo.csv`: `n_janela_comum`, `media_janela_comum` e `acumulado_janela_comum`.
- **Parcial:** `parcial=true` marca a observação de período incompleto (por exemplo 2026 acumulado no ano) ou preliminar. Para Lula, `mandato_completo=false`.

## 7. Identidade visual: medições e ajustes

**Paleta medida.** Amostrei a média de pixels 5×5 em pontos fixos das 3 artes, e os valores foram idênticos nas três.

| Cor | Medido | Aproximação do briefing |
|---|---|---|
| Verde | `#13893B` | ~#3F8B4A |
| Amarelo | `#FEDD02` | ~#FADF50 |
| Azul-marinho | `#012672` (título `#002470`) | ~#0E2373 |
| Vermelho | `#EA0104` | ~#E02424 |
| Branco | `#FFFFFF` | — |

Vou usar os valores medidos.

**Geometria da arte:**
- O losango ocupa a largura toda: topo a cerca de 12% da altura e base a cerca de 76%.
- O contorno amarelo é paralelo ao losango, a uns 3% de distância.
- As estrelas formam um arco entre 14% e 22% da altura, mais altas perto do centro.

**Contraste WCAG, calculado:**
- Azul sobre amarelo: 10,2:1.
- Branco sobre o verde da arte: **4,50:1**, no limite. Por isso, texto branco pequeno usa o verde escurecido `#0B6B2C` (6,7:1).
- Amarelo sobre verde: 3,3:1, só para display de 24 px ou mais.
- **Âmbar `#C98F00` sobre off-white: 2,6:1**, reprova até o mínimo de 3:1 para elementos gráficos. Proponho o **âmbar escuro `#946800`** (4,6:1 sobre off-white), que passa AA também nos rótulos diretos.
- Na simulação de daltonismo (Machado 2009: protan, deutan e tritan), azul × `#946800` mantêm diferença de luminância de 2,3 a 2,9:1. A distinção principal fica no traço (sólido × tracejado), no marcador (● × ■) e no rótulo direto.

**Tipografia:** Anton (display, ultra-bold condensada), Barlow Condensed 600 (kicker e rótulos) e Barlow 400/500 (texto). As três têm licença OFL e cobrem os acentos do pt-BR. Serão hospedadas localmente como woff2 (pacotes @fontsource).

**Atribuição de cores por governo:** fica numa constante única de configuração.
- Bolsonaro: azul `#012672`, linha sólida, marcador ●.
- Lula 3: âmbar `#946800`, linha tracejada, marcador ■.

**Wireframe:** o cartão, a home e a página do indicador foram mostrados na conversa, com números reais desta coleta. Ao aprovar, salvo como `design/wireframes/fase1.html`, junto com `design/tokens.json`.

## 8. Plano de implementação

### Estrutura

```
comparativo_lula_bozo/
  referencias/                      (existente)
  design/tokens.json, design/wireframes/fase1.html
  etl/
    config/governos.yaml            mandatos (extensível)
    config/indicadores.yaml         fonte de verdade do catálogo; gera catalogo_indicadores.csv
    config/eventos.yaml             eventos de contexto, cada um com URL de fonte oficial
    fontes/  sidra.py bcb.py ipeadata.py inpe.py anp.py datasus.py sinesp.py mds.py fao.py ibge_ftp.py inep.py
    transforma/ atribuicao.py deflacao.py resumos.py
    valida/  checks.py
    run.py                          orquestrador (fetch → raw → processed → validação)
  tests/  test_valores_conhecidos.py test_estrutura.py
  data/raw/<fonte>/<AAAA-MM-DD>/... + data/raw/manifest.jsonl (url, sha256, bytes, coletado_em)
  data/processed/ catalogo_indicadores.csv series.csv resumos_por_governo.csv eventos_contexto.csv
  web/                              Vite + React + TS
  Makefile   (make data | test | web | all)
  .github/workflows/ ci.yml update-data.yml deploy.yml
  README.md docs/METODOLOGIA.md docs/DECISOES.md docs/fase1_relatorio.md
```

### Fase 2: ETL em Python

- **Ambiente:** venv com Python 3.13 do Homebrew (o `uv` não está instalado nesta máquina). O Python 3.9 do sistema não tem openpyxl nem xlrd. Dependências fixadas: pandas, requests, httpx, pyyaml, openpyxl, odfpy, pyreaddbc e pytest.
- **Um módulo por fonte**, cada um com `baixar()` (salva o bruto e registra hash e URL no manifest) e `ler()` (devolve um dataframe tidy). As transformações são genéricas: atribuição, deflação (IPCA para preços e benefícios; INPC para o salário mínimo) e resumos (aritmética, geométrica, acumulado e janela comum).
- **Arquivos brutos grandes** (SIM DBC de cerca de 130 MB por ano, Sinesp de 24 MB por ano) ficam fora do git. O `manifest.jsonl` vai versionado e o Actions guarda cache. Os brutos pequenos entram no git.
- **Robustez das fontes:**
  - O nome do JSON de taxas do PRODES é descoberto lendo `FILE_RATES` no bundle do dashboard.
  - O INEP é baixado via curl.
  - A FAO fica com a edição fixada (`vintage`).
  - O IPEADATA tem retry com timeout longo.
- **Validações automáticas:**
  - Duplicatas por (indicador, período, UF).
  - Buracos inesperados, com lista de lacunas conhecidas permitidas (ANP 2020, PNAD Educação 2020–21).
  - Unidades conforme o catálogo e faixas plausíveis por indicador.
  - Governo e `mes_do_mandato` coerentes com `governos.yaml`.
  - **Valores de referência coletados nesta fase:** IPCA 2021 = 10,06; IPCA jan/19–dez/22 = 26,93; desocupação out–dez/2025 = 5,1; PIB 2020 = −3,3; PRODES 2021 = 13.038; PRODES 2025 = 5.731; Gini 2024 = 0,504; extrema pobreza 2021 = 9,0; FAO PoU 2020–22 = 3,5.
- **Eventos de contexto:** pandemia, Auxílio Emergencial, guerra na Ucrânia, LC 194/2022, EC 123/2022, crise hídrica de 2021, secas na Amazônia em 2023–24, enchentes no RS em 2024, novo Bolsa Família em 2023, e as mudanças metodológicas (Novo CAGED, pesos POF no IPCA, reponderação da PNAD). Cada evento precisa de **URL de ato ou fonte oficial**; o que não tiver fonte verificável sai da lista.

### Fase 3: dashboard

**Stack:** Vite + React + TypeScript + ECharts (`echarts/core` com tree-shaking e renderer SVG; tem padrões decal, linhas tracejadas, `markArea` para mandatos e eventos, e ARIA). Os CSVs são lidos com d3-dsv. O site é estático, no GitHub Pages.

Por que não Streamlit: exige servidor, controla pior a identidade visual e o mobile, e complica o PNG e o estado na URL.

**Estado na URL:** `#/i/desemprego?m=media&janela=comum&eventos=1`, além de `#/` e `#/metodologia`.

**Componentes:**
- `CartaoIndicador`: losango; abaixo de 480 px vira painel chanfrado.
- `CartaoExportavel`: SVG de 1080×1350 com as fontes embutidas em base64, convertido em canvas e depois em PNG, com Web Share no celular. As props obrigatórias (janela de cada governo, "parcial", fonte e data) são exigidas pelo tipo, então não há como gerar o cartão sem elas.
- `GraficoMesMandato`, `GraficoCalendario` (faixas dos mandatos), `BarrasAnuais`.
- Interruptor de eventos.
- `TabelaDados`: alternativa acessível a cada gráfico.
- Botão "Baixar CSV".
- Página Metodologia: regra de atribuição, aviso de que correlação não é causalidade, lista de limitações e quem mantém o painel.

**Acessibilidade:**
- Script de CI que valida o contraste dos pares de tokens.
- axe-core rodando no Playwright.
- Navegação por teclado.
- Texto alternativo gerado a partir dos resumos.
- `Intl.NumberFormat('pt-BR')`.

### Fase 4: qualidade e entrega

- **README:** como rodar, como atualizar os dados, como adicionar um indicador (entrada no YAML + função de fonte + teste) e como adicionar um governo (entrada no YAML).
- **`docs/DECISOES.md`:** registro das decisões, com as regras da seção 6 e a escolha de cores.
- **`update-data.yml`:** roda toda semana, executa `make data` e os testes, e abre um **PR com o resumo dos valores que mudaram**. Não faz merge automático.

## 9. Riscos e pendências

- **Formatos mudam:** o arquivo `rates20XX.json` do INPE e as tabelas da SIS, que vêm por edição. Mitigação: descoberta automática e testes que quebram com clareza.
- **Revisões silenciosas:** PIB, FAO e CAGED são revistos. Mitigação: guardar a versão (vintage) e a data de coleta, e mostrar a data de atualização no cartão.
- **Defasagem em saúde e segurança:** o SIM definitivo vai só até 2024. O Sinesp depende da qualidade de cada UF.
- **Peso dos dados brutos:** os 7z do CAGED têm cerca de 50 MB por mês. Por isso o IPEADATA é a fonte de série e o microdado serve só para validação por amostragem.
- **Pendências que dependem de você na Fase 3:** nome ou organização de quem mantém o painel (para a página de Metodologia) e a conta ou repositório no GitHub para o deploy.

## 10. Verificação de ponta a ponta

1. `make data` partindo do zero gera os 4 CSVs e o `manifest.jsonl`. `make test` passa, incluindo os valores de referência da seção 8.
2. Rodar o ETL de novo sem mudança nas fontes deve deixar `data/processed` idêntico (determinismo).
3. `npm run build` e os testes Playwright: smoke das 3 rotas, axe sem violações, e o PNG exportado com 1080×1350 contendo as janelas de cada governo, "parcial", fonte e data.
4. Conferência manual no preview: cada cartão da home mostra o período coberto e o "parcial" quando for o caso; os filtros, a busca e o estado na URL sobrevivem ao recarregar a página.

## Decisões adotadas por padrão (aprovadas em 11/10/2026)

- Usar a paleta medida em vez dos valores aproximados, e o âmbar `#946800` em vez de `#C98F00`.
- Na home, a "janela comum" vem ligada por padrão; o mandato completo é a alternativa.
- CAGED: série pelo IPEADATA (fonte primária MTE), com validação nos microdados do PDET.
- Atualização semanal via PR, sem merge automático.
- **Primeiro passo após a aprovação:** salvar `docs/fase1_relatorio.md` (este relatório), `design/tokens.json` e `design/wireframes/fase1.html`.
