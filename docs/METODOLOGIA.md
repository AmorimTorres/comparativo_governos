# Metodologia

## Princípios

1. **Nenhum número digitado à mão.** Todo valor vem de arquivo baixado por `etl.comum.obter()`, que registra a URL, o hash SHA-256, o tamanho e a data de coleta em `data/raw/manifest.jsonl`.
2. **Comparação justa.** Mesma série, mesma métrica e mesma janela de tempo. Por padrão, o painel compara a **janela comum**: só os meses (ou anos) de mandato que existem para os dois governos.
3. **Mandato em curso.** O governo Lula 3 é sempre marcado como parcial (`mandato_completo = false`). Valores de períodos incompletos (ano corrente, mês em andamento, dados ainda incompletos na fonte) ficam fora das médias e aparecem nos gráficos com marcador vazado.
4. **Melhor resultado por dado, sem placar geral.** Quando a direção desejável é consensual (`sentido_desejavel` diferente de `neutro`) e o indicador não é de contexto, uma estrela marca o governo com o melhor número na métrica e na janela exibidas. Não há contagem de estrelas. O destaque pode ser desligado (parâmetro `d=0` na URL).
5. **Contexto.** Os eventos de `etl/config/eventos.yaml` aparecem nos gráficos, cada um com fonte oficial.

## Atribuição a governos

Código: `etl/transforma/atribuicao.py`. Mandatos: `etl/config/governos.yaml`.

| Tipo de dado | Regra | Observação |
|---|---|---|
| Mensal | mês pertence a quem governava | jan/2023 é o mês 1 do governo Lula 3 |
| Trimestre móvel (PNAD) | regra `fim`: mês final do trimestre | os 2 primeiros de cada mandato são marcados como transição |
| Acumulado em 12 meses | regra `fim` | os 11 primeiros meses de cada mandato incluem meses do governo anterior |
| Trimestral e anual | trimestre ou ano civil | — |
| PRODES (agosto a julho) | regra `centro`: o governo com 7 dos 12 meses | PRODES 2019 e 2023 marcados (5 meses do governo anterior) |
| Triênio da FAO | regra `centro`: o governo com 2 dos 3 anos | triênios mistos marcados |
| IDEB (bienal) | ano de aplicação | — |

`mes_do_mandato` (1–48) é contado pelo mês final do período, só para dados mensais, de trimestre móvel e trimestrais. `ano_do_mandato` (1–4) vem do ano da data de referência da regra. Períodos que cruzam a troca de governo recebem na `observacao` a nota "transição: N de M meses fora do governo atribuído".

## Métricas (resumos_por_governo.csv)

- **media:** média simples das observações que entram no resumo (`entra_no_resumo = True`). Não é calculada quando há valores censurados (por exemplo "<2,5%" da FAO).
- **acumulado:** `composto` para variações percentuais, ou seja ((1 + v₁/100) × … × (1 + vₙ/100) − 1) × 100; `soma` para fluxos. Vazio quando não faz sentido.
- **valor_inicio e valor_fim, minimo e maximo:** sempre com o período correspondente (`periodo_*`).
- **Variantes `*_janela_comum`:** as mesmas métricas restritas às posições do mandato presentes nos dois governos. `janela_comum` descreve a janela (ex.: "meses 1–44 do mandato", "meses 1–45 do mandato, exceto 21").
- **periodos_censurados:** períodos cujo valor é só um limite; o painel exibe "menos de".

## Melhor resultado

Código: `destaque()` em `web/src/metricas.ts`.

- Compara os números exatamente como aparecem: mesma métrica, mesma janela e mesma precisão de exibição. Iguais na precisão exibida = empate (sem estrela).
- Média, acumulado, último valor, pico e vale: vence o menor valor quando `menor_melhor` e o maior quando `maior_melhor`.
- Início → fim: vence a variação (fim − início) mais favorável. O valor inicial não é comparado sozinho, porque reflete também o governo anterior.
- Valores censurados ("menos de 2,5%"): só decidem quando o outro valor está no limite ou acima; caso contrário, não há estrela.
- A diferença exibida é em pontos percentuais para indicadores em % e, nos demais, em % do valor do outro governo.
- Indicadores `neutro` (gasolina, botijão, salário mínimo, Selic, famílias no Bolsa Família, câmbio, endividamento, dívida, resultado primário, balança comercial) e de contexto nunca recebem estrela. Para mudar isso, altere `sentido_desejavel` em `etl/config/indicadores.yaml` e registre a decisão.

## O que fica fora das médias

Todos os critérios abaixo vêm dos próprios dados ou da nota oficial da fonte, sem datas digitadas:

- **PIB do ano em curso:** acumulado até o último trimestre divulgado.
- **Mês em andamento:** focos de queimadas e Selic.
- **SIM (homicídios por mês, COVID-19):**
  - anos classificados como "prévia" na nota do TabNet;
  - meses de anos não finais cujo total de óbitos por todas as causas fica abaixo de 85% do mesmo mês do último ano final.
- **Sinesp:** meses em que menos de 27 UFs informaram.
- **Bolsa Família (benefício médio):** meses em que o valor médio nominal cai a menos da metade da mediana de 2019. São os meses de 2020–2021 em que as famílias receberam o Auxílio Emergencial no lugar do benefício regular.

## Deflação

Valores monetários de preços (combustíveis, benefício do Bolsa Família) são deflacionados pelo IPCA (SIDRA 1737, variável 2266) para reais do último mês disponível. O salário mínimo é deflacionado pelo INPC (SIDRA 1736, variável 2289). O rendimento do trabalho já vem deflacionado pelo IBGE.

## Validações automáticas (`etl/valida/checks.py`)

O pipeline falha, sem gravar dados quebrados no painel, se encontrar:

- duplicatas por (indicador, período, UF);
- valores vazios;
- unidade diferente da do catálogo;
- valores fora de faixas plausíveis (exceto períodos marcados como parciais);
- buracos inesperados na série (as lacunas conhecidas e justificadas ficam em `LACUNAS_CONHECIDAS`);
- `mes_do_mandato` fora de 1–48 ou `ano_do_mandato` fora de 1–4;
- período inteiramente dentro de um mandato atribuído a outro governo;
- mandato em curso marcado como completo.

Os testes (`tests/`) conferem valores pontuais coletados diretamente nas fontes na Fase 1, a estrutura dos CSVs, as regras de atribuição e o contraste das cores.

## Correlação não é causalidade

Os indicadores descrevem o que aconteceu em cada período. Muitos dependem de fatores externos (preços internacionais, clima, pandemia), de outros poderes e entes (Congresso, estados, Banco Central autônomo) e de decisões de governos anteriores com efeito defasado. O painel não atribui causa.

## Limitações

- O governo Lula 3 está em curso; médias e acumulados mudam até o fim do mandato.
- Dados anuais têm defasagem: pobreza (SIS) até 2024; mortalidade infantil e homicídios com 2025 preliminar.
- As fontes revisam dados (PIB, PNAD reponderada em 2021 e 2025, FAO a cada edição, dados preliminares do SIM). Vale a versão da data de coleta, registrada em cada linha (`coletado_em`).
- O Sinesp depende das secretarias estaduais e de mudanças na classificação de crimes (feminicídio, por exemplo).
- A categoria B34 do SIM inclui, além da COVID-19 (B34.2), outras viroses não especificadas; o valor de 2019 serve de linha de base.
- Indicadores nacionais escondem diferenças regionais e entre grupos sociais.
