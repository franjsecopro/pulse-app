.ONESHELL:
.PHONY: dev build lint test install migrate

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
	./venv/Scripts/python -m alembic upgrade head
	@echo "Database migrated"

dev: install migrate
	./venv/Scripts/uvicorn main:app --reload

build:
	# Build commands (add as needed)

lint:
	# Lint commands (add as needed)

test:
	# Test commands (add as needed)
