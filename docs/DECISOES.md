# Registro de decisões

Decisões de método e de implementação, com o motivo. Datas no formato AAAA-MM-DD.

## 2026-10-11 · Fase 1 aprovada

O relatório completo está em [fase1_relatorio.md](fase1_relatorio.md). Decisões aprovadas:

- **Paleta medida nas artes, e não a aproximada do briefing.** Verde `#13893B`, amarelo `#FEDD02`, azul-marinho `#012672`, vermelho `#EA0104` (média de pixels 5×5 nas três artes; valores idênticos).
- **Âmbar do governo B: `#946800`, e não `#C98F00`.** O `#C98F00` dá 2,64:1 sobre o off-white e reprova até o mínimo de 3:1 para elementos gráficos; o `#946800` dá 4,62:1 e passa AA também em rótulos de texto.
- **Janela comum ligada por padrão na home.** Compara só os meses (ou anos) do mandato que existem para os dois governos.
- **CAGED:** série pelo IPEADATA (`CAGED12_SALDON12`, fonte primária MTE/Novo CAGED). A validação por amostragem nos microdados do PDET ficou pendente (ver abaixo).
- **Atualização semanal via PR, sem merge automático.**

## 2026-10-11 · Fase 2 (pipeline)

- **Ambiente:** venv com Python 3.13 do Homebrew, no lugar do `uv` (não instalado nesta máquina).
- **Atribuição por governo** (`etl/transforma/atribuicao.py`), com duas regras:
  - `centro` (padrão): governo do ponto médio do período. Equivale à maioria dos meses: o PRODES vai para quem governava em janeiro, e o triênio da FAO para quem tem 2 dos 3 anos.
  - `fim`: governo do último mês. Usada no trimestre móvel da PNAD (convenção do IBGE) e nos acumulados em 12 meses.
  - Períodos que cruzam a troca de governo recebem a nota automática "transição: N de M meses fora do governo atribuído".
- **Acumulado:** `composto` para variações percentuais (IPCA, PIB) e `soma` para fluxos (empregos, km², focos, vítimas).
- **O que fica fora das médias:** ano em curso (PIB 2026), mês em andamento, meses incompletos no SIM e no Sinesp, e meses do Bolsa Família pagos via Auxílio Emergencial. Esses valores aparecem nos gráficos com marcador vazado.
- **Meses incompletos, detectados pelos próprios dados** (sem datas digitadas):
  - SIM: mês de ano não final com total de óbitos (todas as causas) menor que 85% da mediana mensal do último ano final.
  - Sinesp: mês em que menos de 27 UFs informaram.
  - Bolsa Família: mês com benefício médio nominal menor que metade da mediana de 2019.
- **Homicídios:** X85–Y09 (agressões) + Y35–Y36 (intervenções legais), por residência, via TabNet. A população vem da Projeção da População do IBGE, revisão 2024, para todos os anos (série consistente com o Censo 2022). O ano em curso fica de fora.
- **COVID-19:** categoria CID-10 B34 no TabNet. O SIM codifica a COVID-19 como B34.2 e o TabNet não abre subcategorias; o valor de 2019 serve de linha de base. A COVID entra como camada de contexto, sem comparação de desempenho.
- **IDEB:** o arquivo `divulgacao_brasil_ideb_2025` tem o cabeçalho técnico `VL_OBSERVADO_2023` em branco nos anos finais. Por isso o coletor usa o cabeçalho legível ("IDEB 2023 (N x P)").
- **Resultado primário:** o SGS 5793 publica a NFSP (positivo = déficit); o painel inverte o sinal (positivo = superávit) e avisa nas ressalvas.
- **SIM e SINASC via TabNet, e não via microdados DBC.** O TabNet do DATASUS aceita consultas automatizadas (POST) e devolve tabelas oficiais já agregadas, inclusive dos anos preliminares, com uma nota que diz até que ano os dados são finais. Isso evita baixar cerca de 800 MB de microdados por execução. Por isso o `pyreaddbc` previsto no plano não é usado. Os ODS do IBGE são lidos com a biblioteca padrão, dispensando o `odfpy`.
- **Rendimento do trabalho pela tabela mensal 6390**, e não pela trimestral 5436, que não tem os trimestres de 2020T2 a 2022T1.
- **Brutos fora do git.** Os arquivos somam centenas de MB (Sinesp, focos de queimadas, DETER). O `data/raw/manifest.jsonl` é versionado com URL, hash SHA-256, tamanho e data de cada arquivo. Isso diverge do plano, que previa versionar os brutos pequenos; a troca foi pela simplicidade, e o manifesto preserva a rastreabilidade.
- **Reaproveitamento de brutos de períodos fechados:** meses de focos encerrados há mais de 60 dias, meses do DETER com mais de 90 dias e anos antigos do Sinesp e dos focos são reaproveitados do cache, em vez de baixados toda semana.
- **Eventos de contexto:** só entram com ato oficial ou fonte de órgão público ou organismo internacional, conferidos em 2026-10-11 (`etl/config/eventos.yaml`).

## 2026-10-12 · Nova experiência visual e destaque do melhor resultado

A pedido, o painel passou a destacar, em cada dado comparado, o governo com o melhor resultado. Isso substitui o princípio original "sem vencedor", que previa só uma seta discreta. Salvaguardas mantidas:

- **Só onde a direção é consensual.** Indicadores `neutro` e de contexto ficam sem estrela, com a frase "Sem direção consensual".
- **Mesma métrica, mesma janela, mesma precisão.** O destaque usa o número exibido; empate na precisão exibida não tem estrela.
- **Sem placar geral.** Não há contagem de estrelas nem "vencedor" do painel.
- **Parcial continua visível.** O selo PARCIAL acompanha o número de Lula 3, inclusive dentro do destaque.
- **Desligável.** Interruptor "Destacar o melhor resultado" na home e no indicador (`d=0` na URL).
- **Imagem compartilhada.** Mostra o mesmo destaque e a direção desejável.

Mudanças de experiência:

- Números grandes que contam até o valor.
- Destaque no "globo" azul da bandeira, com estrela e faixa "MELHOR".
- Minigráfico de trajetória por mês do mandato em cada cartão.
- Primeiro indicador de cada tema em faixa larga.
- Barra de temas fixa no topo e métrica em botões.
- Indicador sorteado no topo da home, entre todos os do núcleo e sem curadoria, com botão "Sortear outro" (`h=<id>` na URL fixa o sorteio).
- Tabela "Todas as métricas" com o melhor de cada linha na página do indicador.
- As animações respeitam "reduzir movimento" e usam só transformações, sem opacidade em texto, para manter o contraste em todos os quadros.

## Pendências

- Validar o Novo CAGED por amostragem nos microdados do PDET (`ftp.mtps.gov.br`; arquivos 7z de cerca de 50 MB por mês).
- Taxa de abandono escolar (INEP) e gasto federal em saúde (Tesouro, COFOG): fontes verificadas, ainda não implementadas.

## Revisões de dados pelas fontes

Registre aqui quando um teste de `tests/test_valores_conhecidos.py` falhar por revisão oficial (data, indicador, valor antigo → novo, fonte).
