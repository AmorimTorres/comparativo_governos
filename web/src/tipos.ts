export type Periodicidade = "mensal" | "trimestre_movel" | "trimestral" | "anual" | "anual_prodes" | "bienal" | "trienal";
export type Sentido = "menor_melhor" | "maior_melhor" | "neutro";

export interface Indicador {
  indicator_id: string;
  tema: string;
  nome: string;
  descricao_curta: string;
  unidade: string;
  periodicidade: Periodicidade;
  sentido_desejavel: Sentido;
  fonte_orgao: string;
  fonte_tabela_ou_serie: string;
  url_fonte: string;
  url_api: string;
  metodologia_resumo: string;
  ressalvas: string;
  quebra_metodologica: string;
  nivel_geografico: string;
  grupo: string;
  camada: "nucleo" | "reserva" | "contexto";
  ordem: number;
  regra_atribuicao: "centro" | "fim";
  acumulado: "" | "composto" | "soma";
  metrica_padrao: "media" | "acumulado" | "fim";
  casas_decimais: number;
  ultimo_periodo: string;
  coletado_em: string;
}

export interface Observacao {
  indicator_id: string;
  periodo: string;
  data_inicio: string;
  data_fim: string;
  valor: number;
  unidade: string;
  uf: string;
  governo: string;
  mes_do_mandato: number | null;
  ano_do_mandato: number | null;
  parcial: boolean;
  coletado_em: string;
  fonte_url: string;
  observacao: string;
  qualificador: string;
  entra_no_resumo: boolean;
}

export interface Resumo {
  indicator_id: string;
  governo: string;
  media: number | null;
  acumulado: number | null;
  valor_inicio: number;
  periodo_inicio: string;
  valor_fim: number;
  periodo_fim: string;
  minimo: number;
  periodo_minimo: string;
  maximo: number;
  periodo_maximo: string;
  periodo_coberto: string;
  n_observacoes: number;
  mandato_completo: boolean;
  n_janela_comum: number;
  janela_comum: string;
  media_janela_comum: number | null;
  acumulado_janela_comum: number | null;
  valor_inicio_janela_comum: number | null;
  periodo_inicio_janela_comum: string;
  valor_fim_janela_comum: number | null;
  periodo_fim_janela_comum: string;
  minimo_janela_comum: number | null;
  periodo_minimo_janela_comum: string;
  maximo_janela_comum: number | null;
  periodo_maximo_janela_comum: string;
  periodo_coberto_janela_comum: string;
  periodos_censurados: string[];
  observacao: string;
}

export interface Evento {
  data_inicio: string;
  data_fim: string;
  evento: string;
  categoria: string;
  indicadores_afetados: string[];
  fonte_url: string[];
  descricao: string;
  exibir_no_grafico: boolean;
}

export interface EstiloGoverno {
  cor: string;
  traco: "solido" | "tracejado" | "pontilhado";
  marcador: "circulo" | "quadrado" | "triangulo" | "losango";
}

export interface Governo {
  id: string;
  nome: string;
  nome_completo: string;
  inicio: string;
  fim: string;
  em_curso: boolean;
  estilo: EstiloGoverno;
}

export interface Dados {
  catalogo: Indicador[];
  resumos: Resumo[];
  eventos: Evento[];
  governos: Governo[];
  comparados: string[];
  executadoEm: string;
}
