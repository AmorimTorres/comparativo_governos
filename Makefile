PYTHON ?= python3
PY := .venv/bin/python
PIP := .venv/bin/pip

.PHONY: help venv data data-offline test contraste web web-dev all

help:
	@echo "make venv          cria o ambiente Python e instala as dependências"
	@echo "make data          baixa as fontes oficiais e refaz data/processed"
	@echo "make data-offline  refaz data/processed a partir dos brutos já salvos (sem rede)"
	@echo "make test          roda os testes (valores conhecidos, estrutura, contraste)"
	@echo "make web           gera o site estático em web/dist"
	@echo "make web-dev       abre o site em modo de desenvolvimento"
	@echo "make all           data + test + web"

venv:
	$(PYTHON) -m venv .venv
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt

data:
	$(PY) -m etl.run

data-offline:
	ETL_OFFLINE=1 $(PY) -m etl.run

test:
	$(PY) -m pytest -q

contraste:
	$(PY) scripts/contraste.py

web:
	cd web && npm ci && npm run build

web-dev:
	cd web && npm run dev

all: data test web
