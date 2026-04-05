.ONESHELL:
.PHONY: dev install migrate makemigrations

# Verificar que estamos en Windows y que el entorno virtual existe
venv_exists := $(shell if [ -d "venv" ]; then echo "yes"; else echo "no"; fi)

install:
	@if [ "$(venv_exists)" = "no" ]; then \
		python -m venv venv; \
		echo "Created virtual environment"; \
	fi
	./venv/Scripts/pip install -r requirements.txt
	@echo "Dependencies installed"

migrate:
	./venv/Scripts/alembic upgrade head
	@echo "Database migrated"

makemigrations:
	./venv/Scripts/alembic revision --autogenerate -m "$(msg)"
	@echo "Migration created"

dev: install
	./venv/Scripts/uvicorn main:app --reload --port 8001
