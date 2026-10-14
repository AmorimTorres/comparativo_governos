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

## 2026-10-12 · Publicação na Vercel

- O site é publicado na Vercel como projeto estático único, com raiz em `web/` (`web/vercel.json`). O GitHub Pages foi removido.
- As dependências do Python ficam em `requirements-etl.txt`, e não em `requirements.txt`. Com o nome padrão, a Vercel detectava o repositório como uma aplicação Python e sugeria dois serviços. O Python só roda na coleta (`make data` e GitHub Actions), nunca na Vercel.

## 2026-10-13 · Feminicídios: registro em consolidação

Na janela comum, os feminicídios registrados no Sinesp eram menores no governo Bolsonaro. A análise dos próprios dados mostrou por quê:

- **O registro mudou.** Os feminicídios registrados sobem quase todo ano desde 2015, inclusive em 2019–2022. Ao mesmo tempo, a parcela das mulheres assassinadas (feminicídio + homicídio doloso, vítimas mulheres) classificada como feminicídio passou de cerca de 16% em 2015 para mais de 40% em 2025. Em 2015, só 15 UFs registraram algum feminicídio; desde 2019, todas as 27.
- **O total de mulheres mortas não acompanhou a alta.** A soma das duas categorias e os homicídios de mulheres no SIM ficaram estáveis ou caíram no mesmo período.

Decisões:

- **Feminicídios sem estrela.** `sentido_desejavel` passa a `neutro`, com `motivo_sem_destaque` explicando que o registro não é comparável entre períodos. É o mesmo critério que levou a descartar a cobertura vacinal.
- **Dois indicadores comparáveis, com estrela.** "Mulheres assassinadas (dados da polícia)" (Sinesp, feminicídio + homicídio doloso de mulheres, mensal) e "Mulheres assassinadas a cada 100 mil (dados da saúde)" (SIM, taxa por 100 mil mulheres, anual).
- **Um indicador de qualidade do registro, sem estrela.** "% dos assassinatos de mulheres registrados como feminicídio" (por ano, complementar).
- **Análise na página de feminicídios**, com gráfico e texto calculados das séries.
- **Eventos de contexto:** Lei 13.104/2015 e Lei 14.994/2024 (planalto.gov.br).
- **Verificação de que as categorias do Sinesp não se sobrepõem.** Somar feminicídio e homicídio doloso não conta ninguém duas vezes: a soma fica próxima do total de homicídios de mulheres do SIM. Se o homicídio doloso já incluísse os feminicídios, a soma ficaria muito acima.
- **Cache do Sinesp passou para a versão v3**, com a coluna de vítimas mulheres.
- **Nova coluna `motivo_sem_destaque` no catálogo:** é o texto opcional mostrado no lugar da estrela.

### 2026-10-13 · Títulos dos indicadores de violência contra mulheres

Os títulos passaram a dizer o que cada número conta, para o público não confundir os quatro:

- **"Casos registrados como feminicídio"** (antes "Feminicídios"): deixa claro que é o registro policial.
- **"Total de mulheres assassinadas"**: todas as vítimas mulheres de crimes intencionais, qualquer que seja a classificação (Sinesp).
- **"De cada 100 mil mulheres, quantas foram assassinadas por ano"** (antes "Homicídios de mulheres"): taxa anual pelos atestados de óbito (SIM). A pergunta no título explica o número. Exemplo: 3,56 = média de 2019–2021, cerca de 3.800 mulheres por ano.
- **"% dos assassinatos de mulheres registrados como feminicídio"**: passou de complementar para o núcleo (sem estrela), ao lado dos feminicídios, porque explica o número deles.

- "De cada 100 mil mulheres, quantas foram assassinadas por ano" saiu da home a pedido e virou indicador complementar. Continua na análise da página de feminicídios e em "Incluir indicadores complementares".

### 2026-10-14 · Remoção da etiqueta visual "PARCIAL" e expansão da Metodologia

- **Etiqueta visual removida da home e dos cartões:** O selo/pill visual "PARCIAL" que acompanhava Lula 3 foi retirado dos cartões e do herói para eliminar ruído e sobrecarga gráfica, já que o mandato em andamento é um fato de conhecimento público.
- **Discussão aprofundada na Metodologia:** A seção `#/metodologia` passou a discorrer minuciosamente sobre o tratamento dos números parciais do governo Lula 3 (janela comum equivalente, preservação de sazonalidade, exclusão de dados incompletos das médias, métricas de variação e defasagens oficiais).

## 2026-10-13 · Saúde: sete novos indicadores

Até aqui o tema tinha só a mortalidade infantil. Os candidatos foram escolhidos por relevância política e apelo público e testados com download real:

| Indicador | Fonte | Sentido | Observação |
|---|---|---|---|
| Mortalidade materna | SIM + SINASC (TabNet) | menor é melhor | Pico da COVID em 2020–2021 |
| Vacinação contra o sarampo (MCV1) | OMS/UNICEF, WUENIC (API GHO) | maior é melhor | Ver nota abaixo |
| Vacinação infantil completa (DTP3) | OMS/UNICEF, WUENIC (API GHO) | maior é melhor | Ver nota abaixo |
| Cirurgias eletivas no SUS | SIH (TabNet), grupo 04, caráter eletivo, mês de processamento | maior é melhor | Pausa da COVID; Programa de Redução das Filas em 2023 |
| Suicídios por 100 mil | SIM, X60–X84 | menor é melhor | Tendência de alta desde 2012 |
| Gasto federal em saúde | RREO da União, Anexo 2, função Saúde, empenhado, IPCA médio (API SICONFI) | neutro | Desde 2017; escolha de política, com créditos da COVID |

- **Vacinação.** Antes descartada: a cobertura do Ministério da Saúde muda de sistema em 2023 (SI-PNI → RNDS). Agora entra pela estimativa WUENIC, que a OMS e o UNICEF revisam com o mesmo método para toda a série. A data da revisão vai na `observacao` de cada ano.
- **Gasto federal em saúde.** Começa em 2017: antes disso o RREO não separa as despesas intraorçamentárias e usa outro rótulo de coluna.
- **Eventos novos, com fonte oficial:** Portaria GM/MS 90/2023 (filas), Movimento Nacional pela Vacinação (OPAS, 2023) e recertificação do Brasil como livre do sarampo (OPAS, nov/2024).
- **Eventos da COVID** passaram a afetar também os novos indicadores ligados à pandemia.
- **Unidade "R$ bi":** o site exibe valores em bilhões de reais com sufixo "bi" (`web/src/formato.ts`).

- **Mortes por dengue:** chegou a entrar, mas saiu a pedido em 14/10/2026, junto com os eventos do El Niño e do COE Dengue.

## 2026-10-14 · Novo marcador dos governos

- **O que mudou.** O círculo (Bolsonaro) e o quadrado (Lula 3) deram lugar a um marcador único: o traço da linha do gráfico terminando no losango da identidade.
  - Bolsonaro: azul-marinho, traço sólido.
  - Lula 3: âmbar, traço tracejado.
- **Onde aparece.** Legenda, duelos, tabelas, legenda do cartão grande, Metodologia e imagem compartilhada.
- **Nos gráficos.** Os pontos das duas linhas viram losangos (`governos.yaml`), vazados quando o dado é parcial.
- **Acessibilidade.** Os governos continuam diferenciados por cor, pelo traço (sólido × tracejado) e pelo rótulo direto, nunca só pela cor.

## Pendências

- Validar o Novo CAGED por amostragem nos microdados do PDET (`ftp.mtps.gov.br`; arquivos 7z de cerca de 50 MB por mês).
- Taxa de abandono escolar (INEP): fonte verificada, ainda não implementada.

## Revisões de dados pelas fontes

Registre aqui quando um teste de `tests/test_valores_conhecidos.py` falhar por revisão oficial (data, indicador, valor antigo → novo, fonte).

## Tipografia: Reel (Adobe Fonts)

- Títulos e números em `reel-medium`; rótulos em `reel-short` (kit `jgs6nnl`, carregado em `web/index.html`).
- As faces "Reel Titulo" e "Reel Rotulo" (`web/src/estilos/reel.css`) usam os arquivos do kit com `size-adjust` e `ascent/descent-override` para repetir a altura das maiúsculas e as métricas da Anton e da Barlow Condensed. Assim nenhum tamanho, espaçamento vertical ou alinhamento do layout precisou mudar, e se o kit falhar o navegador cai nas fontes anteriores sem desalinhar.
- Espaçamento entre letras: +0,03em nos rótulos e +0,01em nos títulos em relação aos valores anteriores (o Reel é mais estreito).
- Textos cinza (contagem de indicadores) continuam em Barlow Condensed; o texto corrido continua em Barlow.
- O domínio de produção precisa estar autorizado no kit do Adobe Fonts.
- A imagem exportada (compartilhar) continua com Anton e Barlow embutidas, porque as fontes do kit não podem ser embutidas no arquivo.

## Marcador dos governos em cápsula branca

- O marcador (traço do gráfico terminando no losango) agora fica dentro de uma cápsula branca com contorno fino. Com fundo próprio, ele é idêntico sobre o amarelo, sobre o azul do lado "Melhor", nas legendas brancas e na imagem exportada. Antes, no lado "Melhor", o marcador era repintado de branco para não sumir no azul.
- Alternativas avaliadas: inicial em círculo, nome em etiqueta colorida e só o nome nos cartões. A cápsula foi escolhida por manter a ligação direta entre o cartão e as linhas dos gráficos.
