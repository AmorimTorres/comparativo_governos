"""Infraestrutura comum: caminhos, HTTP com retentativas e cache de arquivos brutos.

Todo download passa por `obter()`, que grava o arquivo em
data/raw/<fonte>/<AAAA-MM-DD>/<nome> e registra URL, hash SHA-256, tamanho e
data de coleta em data/raw/manifest.jsonl. Com a variável de ambiente
ETL_OFFLINE=1, nada é baixado: usa-se o bruto mais recente já salvo.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

import requests

RAIZ = Path(__file__).resolve().parent.parent
DIR_RAW = RAIZ / "data" / "raw"
DIR_PROCESSED = RAIZ / "data" / "processed"
DIR_INTERIM = RAIZ / "data" / "interim"  # agregados derivados dos brutos (cache)
DIR_CONFIG = Path(__file__).resolve().parent / "config"
MANIFESTO = DIR_RAW / "manifest.jsonl"

# Cabeçalhos simples: alguns servidores públicos (TabNet/DATASUS) travam com
# Accept-Encoding gzip e conexões persistentes.
CABECALHOS = {
    "User-Agent": "painel-governos-dados-oficiais/1.0 (+https://github.com/)",
    "Accept": "*/*",
    "Accept-Encoding": "identity",
    "Connection": "close",
}


def hoje() -> str:
    return os.environ.get("ETL_DATA_COLETA") or dt.date.today().isoformat()


def offline() -> bool:
    return os.environ.get("ETL_OFFLINE") == "1"


class NaoEncontrado(RuntimeError):
    """O servidor respondeu 404 (arquivo ainda não publicado, por exemplo)."""


@dataclass
class Bruto:
    conteudo: bytes
    caminho: Path
    url: str
    coletado_em: str  # AAAA-MM-DD

    def texto(self, encoding: str = "utf-8") -> str:
        return self.conteudo.decode(encoding)

    def json(self):
        return json.loads(self.conteudo.decode("utf-8"))


def _ultimo_salvo(fonte: str, nome: str) -> Path | None:
    base = DIR_RAW / fonte
    if not base.exists():
        return None
    datas = sorted((p for p in base.iterdir() if p.is_dir()), reverse=True)
    for d in datas:
        alvo = d / nome
        if alvo.exists():
            return alvo
    return None


def _baixar_requests(url, metodo, params, data, headers, timeout):
    h = dict(CABECALHOS)
    if headers:
        h.update(headers)
    r = requests.request(metodo, url, params=params, data=data, headers=h, timeout=timeout)
    r.raise_for_status()
    return r.content, r.url


def _baixar_curl(url, timeout):
    # Usado onde o TLS do Python falha (download.inep.gov.br) e em FTP.
    res = subprocess.run(
        ["curl", "-sSfL", "--max-time", str(timeout), url],
        capture_output=True,
        check=False,
    )
    if res.returncode == 22 and b"404" in res.stderr:
        raise NaoEncontrado(f"404 em {url}")
    if res.returncode != 0:
        raise RuntimeError(f"curl falhou ({res.returncode}) em {url}: {res.stderr.decode(errors='replace')[:300]}")
    return res.stdout, url


def obter(
    fonte: str,
    nome: str,
    url: str,
    *,
    metodo: str = "GET",
    params: dict | list | None = None,
    data=None,
    headers: dict | None = None,
    usar_curl: bool = False,
    timeout: int = 180,
    tentativas: int = 4,
    reaproveitar_dias: int | None = None,
) -> Bruto:
    """Baixa (ou reaproveita) um arquivo bruto e o registra no manifesto.

    reaproveitar_dias: se já existe uma cópia salva com até N dias, usa a
    cópia em vez de baixar de novo (para arquivos grandes de períodos já
    fechados, como meses antigos de focos de queimadas ou do DETER).
    """
    if not offline() and reaproveitar_dias is not None:
        salvo = _ultimo_salvo(fonte, nome)
        if salvo is not None:
            idade = (dt.date.fromisoformat(hoje()) - dt.date.fromisoformat(salvo.parent.name)).days
            if 0 <= idade <= reaproveitar_dias:
                return Bruto(salvo.read_bytes(), salvo, url, salvo.parent.name)
    if offline():
        salvo = _ultimo_salvo(fonte, nome)
        if salvo is None:
            raise NaoEncontrado(f"ETL_OFFLINE=1 e não há bruto salvo para {fonte}/{nome}")
        return Bruto(salvo.read_bytes(), salvo, url, salvo.parent.name)

    data_coleta = hoje()
    destino = DIR_RAW / fonte / data_coleta / nome
    if destino.exists():
        return Bruto(destino.read_bytes(), destino, url, data_coleta)

    ultimo_erro = None
    for i in range(tentativas):
        try:
            if usar_curl or url.startswith("ftp://"):
                conteudo, url_final = _baixar_curl(url, timeout)
            else:
                conteudo, url_final = _baixar_requests(url, metodo, params, data, headers, timeout)
            break
        except requests.HTTPError as e:
            if e.response is not None and e.response.status_code == 404:
                raise NaoEncontrado(f"404 em {url}") from e
            ultimo_erro = e
            time.sleep(2 * (i + 1))
            continue
        except Exception as e:  # noqa: BLE001 - registra e tenta de novo
            ultimo_erro = e
            time.sleep(2 * (i + 1))
    else:
        raise RuntimeError(f"Falha ao baixar {url} após {tentativas} tentativas: {ultimo_erro}")

    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(conteudo)
    registro = {
        "fonte": fonte,
        "arquivo": str(destino.relative_to(RAIZ)),
        "url": url_final,
        "metodo": metodo,
        "params": params if isinstance(params, (dict, list)) else None,
        "sha256": hashlib.sha256(conteudo).hexdigest(),
        "bytes": len(conteudo),
        "coletado_em": data_coleta,
    }
    MANIFESTO.parent.mkdir(parents=True, exist_ok=True)
    with MANIFESTO.open("a", encoding="utf-8") as f:
        f.write(json.dumps(registro, ensure_ascii=False) + "\n")
    return Bruto(conteudo, destino, url_final, data_coleta)


def ler_yaml(nome: str):
    import yaml

    with (DIR_CONFIG / nome).open(encoding="utf-8") as f:
        return yaml.safe_load(f)
