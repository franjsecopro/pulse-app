.ONESHELL:
.PHONY: dev install migrate makemigrations init-keys gen-key

# Detect venv at parse time
venv_exists := $(shell if [ -d "venv" ]; then echo "yes"; else echo "no"; fi)

install:
	@if [ "$(venv_exists)" = "no" ]; then \
		python -m venv venv; \
		echo "Created virtual environment"; \
	fi
	./venv/Scripts/pip install -r requirements.txt
	@echo "Dependencies installed"

# Create a .env.keys template the first time.
# IMPORTANT: this file is gitignored — never commit encryption keys.
init-keys:
	@if [ ! -f .env.keys ]; then \
		printf '%s\n' \
			'# .env.keys — encryption keys for dev (DO NOT COMMIT)' \
			'# Format: FIELD_ENCRYPTION_KEYS=key1,key2,...' \
			'# First key = primary (encrypts new data), rest = fallback (decrypts old data).' \
			'# Generate a key with: make gen-key' \
			'FIELD_ENCRYPTION_KEYS=' \
			> .env.keys; \
		echo "✓ Created .env.keys — edit it and add your Fernet key(s)."; \
	else \
		echo ".env.keys already exists. Edit it manually if needed."; \
	fi

# Generate a fresh Fernet key and print to stdout (for rotation workflow)
gen-key:
	./venv/Scripts/python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Inline the keys-load right before the command that needs them.
# This avoids the "dependency runs in a separate shell context" issue
# that some make versions on Windows exhibit.
migrate:
	@if [ -f .env.keys ]; then set -a; . ./.env.keys; set +a; echo "✓ Loaded keys"; else echo "WARNING: no .env.keys"; fi
	./venv/Scripts/alembic upgrade head
	@echo "Database migrated"

makemigrations:
	@if [ -f .env.keys ]; then set -a; . ./.env.keys; set +a; echo "✓ Loaded keys"; else echo "WARNING: no .env.keys"; fi
	./venv/Scripts/alembic revision --autogenerate -m "$(msg)"
	@echo "Migration created"

dev: install
	@if [ -f .env.keys ]; then set -a; . ./.env.keys; set +a; echo "✓ Loaded keys"; else echo "WARNING: no .env.keys"; fi
	./venv/Scripts/uvicorn main:app --reload --port 8001