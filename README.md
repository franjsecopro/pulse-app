# 📊 Gestor de Contabilidad para Autónomos

Sistema completo de gestión de clientes, clases y pagos para trabajadores autónomos. **Privacidad máxima**, datos encriptados en servidor, sincronización automática entre dispositivos.

---

## 🎯 Características principales

### **Fase 1: Desktop MVP (4-6 semanas)** ⭐

#### **Gestión de clientes**
- Registro completo con datos de contacto (nombre, email, teléfono, dirección)
- **Múltiples contratos por cliente** (diferentes hijos/alumnos con diferentes tarifas)
- Campo `payment_name` para matching automático con extratos bancarios
- Estados activo/inactivo
- Soft delete con retención de 1 año (cumple GDPR)

#### **Agenda de clases**
- Sincronización bidireccional con Google Calendar
- Vinculación automática con contratos del cliente
- Duración y tarifa por clase (capturada en el momento)
- Notas personalizadas por clase

#### **Control de pagos**
- Registro manual de pagos
- **Parser automático de extracto bancario CSV** (Hello Bank/BNP Paribas)
  - Extrae ingresos del export CSV del banco
  - Matching inteligente con nombres de clientes
  - Usuario confirma antes de registrar
- Cálculo automático de "clases cubiertas" por pago
- Historial completo de pagos

#### **Reconciliación automática**
- Compara clases esperadas (calendario) vs pagos recibidos
- Sin tolerancia de error (alerta de cualquier discrepancia)
- Reconciliación mensual (con retraso, ya que banco genera el mes siguiente)
- Genera reportes mensuales detallados

#### **Sistema de alertas**
- Centro de notificaciones interno en la app
- Alertas automáticas de discrepancias
  - 🔴 Cliente debe dinero
  - 🟢 Pagos OK
  - 🔵 Cliente con crédito
- Historial persistente y marcable como leído
- Alertas también si pago no puede asociarse a cliente

#### **Reportes y análisis**
- Reportes mensuales (ingresos, clientes morosos, detalles)
- Búsqueda avanzada (filtros por mes, cliente, estado)
- Histórico completo por cliente (todas sus clases y pagos)
- Exportación de reportes (PDF/Excel)

#### **Sincronización y backup**
- Sincronización automática con servidor (PostgreSQL encriptada)
- Backup local diario en SQLite (en tu PC)
- Recuperación automática ante desconexión

### **Fase 2: Comunicación (2-3 semanas)** ⭐⭐

#### **Generador de facturas**
- Template-based (personalizable con tus datos)
- Campos dinámicos (cliente, período, clases, totales)
- Numeración secuencial automática
- Envío por email o WhatsApp
- Historial de facturas enviadas

#### **Recordatorios configurables**
- WhatsApp como canal principal (Email opcional)
- Configuración por usuario:
  - X horas antes del evento (ej: 24h antes de la clase)
  - Hora exacta de envío (ej: "cada día a las 18:00")
  - Template personalizable
- Envío automático o bajo revisión del usuario
- Retry automático si falla
- Historial completo de envíos

### **Fase 3: Móvil (8-10 semanas, futuro)** 🔄

- Ver clases próximas y horarios
- Visualizar clientes y histórico de pagos
- Confirmar pagos (app calcula clases cubiertas)
- Notificaciones de recordatorios y alertas
- Sincronización en tiempo real

---

## 🏗️ Arquitectura

```
┌──────────────────────────────────────────────────────────────┐
│                    USUARIO / DISPOSITIVOS                    │
├──────────────────────────────────────────────────────────────┤
│  Desktop (PyQt6)                │         Móvil (Flutter)    │
│  ├─ Gestión clientes            │     ├─ Visualización       │
│  ├─ Agenda de clases            │     ├─ Confirmación pagos  │
│  ├─ Control de pagos            │     ├─ Notificaciones      │
│  ├─ Upload extracto CSV         │     └─ Alertas             │
│  ├─ Reportes y búsqueda         │                            │
│  ├─ Generación de facturas      │                            │
│  └─ Configuración notificaciones│                            │
└──────────────────┬───────────────────────────────┬──────────┘
                   │                               │
                   └───────────────┬───────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  FastAPI + OAuth2           │
                    │  (Backend seguro)           │
                    │  ├─ Autenticación           │
                    │  ├─ Statement Parser (CSV)  │
                    │  ├─ Reconciliación          │
                    │  ├─ Invoice Generator       │
                    │  ├─ Scheduler (APScheduler) │
                    │  └─ Email/WhatsApp sender   │
                    └──────────────┬──────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
    ┌───▼───────┐          ┌────────▼────────┐        ┌──────▼──────┐
    │PostgreSQL │          │Google Calendar  │        │WhatsApp     │
    │(servidor) │          │API (lectura)    │        │Business API │
    │Encriptado │          │(sincronización) │        │(notificaciones)
    │AES-256    │          │bidireccional    │        │(recordatorios)
    └───┬───────┘          └─────────────────┘        └─────────────┘
        │
    ┌───▼────────────┐
    │SQLite (backup  │
    │local en PC)    │
    │(diario)        │
    └────────────────┘
```

---

## 👥 Entidad Cliente - Estructura detallada

### **Campos principales:**
```python
Client:
  ├─ id: int (PK)
  ├─ name: str              # Nombre en calendario ("Juan García Pérez")
  ├─ payment_name: str      # Para matching con extracto ("García")
  ├─ email: str             # Para envío de facturas
  ├─ phone: str             # Para WhatsApp (opcional)
  ├─ address: str           # Para facturas (opcional)
  ├─ is_active: bool        # ¿Está activo?
  ├─ contract_info: List[Contract]  # Múltiples contratos
  ├─ created_at: datetime
  ├─ updated_at: datetime
  └─ deleted_at: datetime   # Para soft delete (GDPR)

Contract:
  ├─ id: int (PK)
  ├─ description: str       # "María - Colegio" o "Pedro - Instituto"
  ├─ start_date: date       # Inicio del contrato
  ├─ end_date: date         # Fin (NULL = indefinido)
  ├─ hourly_rate: float     # €/hora
  ├─ is_active: bool
  ├─ notes: str             # Notas adicionales
  └─ deleted_at: datetime   # Para soft delete
```

### **Casos de uso:**
- **Cliente simple:** 1 contrato, 1 tarifa (ej: Juan García - Inglés €30/h)
- **Múltiples contratos:** Mismo pagador, diferentes hijos/servicios (ej: Familia López - María €25/h, Pedro €35/h)
- **Histórico:** Contratos finalizados se archivan pero quedan en histórico

---

## 🔄 Flujos principales

### **1. Importación de pagos (CSV)**
```
Usuario → Carga "Relevé de compte" → Parser extrae ingresos
  ↓
Para cada ingreso:
  ├─ Busca nombre en tabla clientes
  ├─ Si coincidencia exacta → auto-asocia
  ├─ Si coincidencia parcial → sugiere opciones
  └─ Si no hay → usuario confirma manualmente
  ↓
Usuario revisa preview y confirma
  ↓
Sistema registra pagos en BD automáticamente
```

### **2. Reconciliación mensual**
```
Usuario → Abre "Reconciliación" → Selecciona mes
  ↓
Para cada cliente:
  ├─ Clases en ese mes (Google Calendar)
  ├─ Tarifa según contrato activo en esa fecha
  ├─ Total esperado = clases × tarifa
  ├─ Total pagado (del extracto o manual)
  └─ Diferencia = alerta si ≠ 0
  ↓
Genera reporte y alertas automáticas
```

### **3. Generación de factura**
```
Usuario → Selecciona cliente + período → Clica "Generar factura"
  ↓
Sistema obtiene:
  ├─ Datos cliente (nombre, email, dirección)
  ├─ Clases del período
  ├─ Tarifa según contrato
  └─ Total y saldo
  ↓
Renderiza template y genera PDF
  ↓
Usuario puede:
  ├─ Descargar PDF
  ├─ Enviar por Email
  └─ Enviar por WhatsApp
```

### **4. Notificaciones de clases (flujo diario)**

> **Estado actual:** implementación temporal vía `wa.me`. El flujo con WhatsApp API + n8n está diseñado pero pendiente de validación de coste con el cliente.

#### Datos ya implementados en BD

```
contracts
  ├─ phone: str (nullable)   # Teléfono del alumno — puede diferir del pagador
  └─ notify: bool            # Flag por contrato — activa el envío
```

#### Flujo temporal (wa.me)

```
Usuario → abre página "Notificaciones de mañana"
  ↓
Backend: GET /api/notifications/tomorrow
  ├─ Obtiene clases con class_date = hoy + 1
  ├─ Filtra: contract.notify == true AND contract.phone IS NOT NULL
  └─ Retorna lista con: cliente, alumno, hora, teléfono
  ↓
Frontend: renderiza una card por clase
  └─ Botón "Notificar" → abre wa.me/+34XXXXXXXXX?text=<mensaje pre-rellenado>
```

#### Flujo objetivo (WhatsApp API + n8n) — pendiente validación

```
n8n workflow — disparado cada día a las 18:00
  ↓
Paso 1: HTTP Request → GET /api/notifications/tomorrow
  └─ Header: Authorization: Bearer <api_key interna>
  ↓
Paso 2: Para cada clase en la respuesta:
  ├─ Construye mensaje con: nombre alumno, hora, fecha
  └─ WhatsApp Business API → envía al contract.phone
  ↓
Paso 3: HTTP Request → POST /api/notifications/log
  └─ Body: [{ class_id, phone, status: "sent"|"failed", sent_at }]
```

#### Endpoints necesarios (aún no implementados)

```
GET  /api/notifications/tomorrow   # Devuelve clases de mañana con notify=true
POST /api/notifications/log        # Registra resultado de envíos (para historial)
```

#### Mensaje de notificación (template)

```
Hola, te recuerdo que mañana {fecha} a las {hora} tenés clase con {nombre_profesor}.
¡Hasta mañana!
```

---

## 🔐 Autenticación

### **OAuth2 + JWT**

La aplicación utiliza autenticación basada en **OAuth2 + JWT** (estándar de la industria).

#### **Flujo de autenticación:**

```
1. REGISTRO/LOGIN:
   ├─ Usuario introduce email + password
   ├─ Servidor valida credenciales
   ├─ Password se hashea con bcrypt (nunca se guarda en plano)
   └─ Servidor genera JWT

2. JWT (JSON Web Token):
   ├─ Token firmado y cifrado
   ├─ Contiene: user_id + fecha expiración
   ├─ Expira en 30 minutos (acceso corto)
   └─ Cliente lo guarda localmente

3. REFRESH TOKEN:
   ├─ Token adicional con validez 7 días
   ├─ Se usa para obtener nuevos JWT sin pedir password
   ├─ Permite sesiones largas sin exponer contraseña
   └─ Se revoca al logout

4. SOLICITUDES AUTENTICADAS:
   ├─ Cada request lleva JWT en header Authorization
   ├─ Servidor valida JWT sin consultar BD (rápido)
   └─ Si JWT expira → usa refresh token → obtiene nuevo JWT
```

#### **Seguridad de autenticación:**

- ✅ **Password fuerte:** Mínimo 12 caracteres (mayús, minús, números, especiales)
- ✅ **Hashing:** Bcrypt (costo 12)
- ✅ **HTTPS:** Obligatorio en producción
- ✅ **Rate limiting:** Max 5 intentos de login/minuto
- ✅ **Token expiry:** Renovación automática (30 min access, 7 días refresh)
- ✅ **Stateless:** No requiere sesiones en servidor
- ✅ **Compatible móvil:** Funciona en Desktop + Flutter

#### **Endpoints de autenticación:**

```
POST   /api/auth/register              # Registro (email + password)
POST   /api/auth/login                 # Login (genera JWT + refresh)
POST   /api/auth/refresh               # Renovar JWT
GET    /api/auth/me                    # Obtener usuario actual
POST   /api/auth/logout                # Cerrar sesión
POST   /api/auth/change-password       # Cambiar contraseña
POST   /api/auth/reset-password        # Recuperación por email (Fase 2)
DELETE /api/auth/account               # Eliminar cuenta (GDPR, Fase 2)
```

---

## 🔐 Privacidad y Seguridad

### **Cifrado de PII en reposo (migración 0020)**

Las columnas de datos personales de clientes y del negocio se cifran en la base con **Fernet** (AES-128-CBC + HMAC-SHA256), de forma transparente para el resto del código:

- `Client`: `email`, `phone`, `whatsapp_phone`, `address`, `tax_id`
- `BusinessProfile`: `tax_id`, `fiscal_address`
- `PaymentIdentifier`: `info`

Fuera de scope (deliberado): `Client.name`, `Client.payment_name` y `PaymentIdentifier.name` quedan en plano porque son la etiqueta humana de cada registro y la clave del matching de pagos.

#### Custodia de la clave

- **Producción:** la clave vive en **Supabase Vault** (cifrada con la root key que custodia Supabase fuera de las tablas). La app la lee al arrancar con un `SELECT` sobre `vault.decrypted_secrets` usando el rol `service_role`. No se guarda en el `.env` de prod.
- **Desarrollo / tests:** la clave se setea como `FIELD_ENCRYPTION_KEYS` en el `.env` (CSV de Fernet keys). La primera key es la primaria; las adicionales son fallback de rotación.
- **Fail-closed:** si no se resuelve ninguna clave en ningún entorno, la app no arranca.

Generar una clave Fernet:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Cargarla en Supabase Vault (producción):
```sql
select vault.create_secret('<key>', 'field_encryption_key');
-- rotación: la nueva se carga como field_encryption_key y la vieja como field_encryption_key_prev
```

#### Rotación

MultiFernet cifra con la primera clave y descifra con cualquiera. Para rotar:
1. Cargar la nueva clave como `field_encryption_key`.
2. Mover la actual a `field_encryption_key_prev`.
3. (Opcional) Re-cifrado gradual: tarea de fondo que recorre filas y las re-cifra con la nueva clave.

El proceso no requiere downtime.

#### Threat model — lo que protege y lo que NO

✅ Protege contra: dump/backup robado, acceso directo a la tabla (Supabase, SQLi de solo lectura), alguien con credenciales de la DB pero sin la clave de cifrado.

❌ NO protege contra: un servidor de aplicación comprometido. Si la app muestra el dato, la app puede descifrarlo (propiedad inherente). Se mitiga sacando la clave del env crudo y se detecta con auditoría (fase futura), pero no se elimina con cripto.

No reemplaza HTTPS ni RLS — son capas distintas (defensa en profundidad). RLS y auditoría de descifrado están en fases futuras.

### **HTTPS/TLS en tránsito**
- **TLS** en tránsito (cliente-servidor y cliente-DB)
- **HSTS** se resuelve en el reverse-proxy del hosting (Nginx, Caddy, etc.) — no es código de la app

### **Hardening de producción (checklist)**
- `APP_ENV=production` (deriva `COOKIE_SECURE=True` automáticamente)
- `SECRET_KEY` real (no el default `dev-secret-key-change-in-production` — la app falla al arrancar si sigue así)
- `FIELD_ENCRYPTION_KEYS` cargada en Supabase Vault (no en el `.env`)
- HTTPS configurado en el reverse-proxy con HSTS habilitado
- Backups automáticos de la DB y de la clave Fernet (si se pierde, los datos cifrados son irrecuperables)

### **Backup y recuperación:**
- Backup automático diario en SQLite (tu PC)
- Recuperación automática ante fallos
- Los datos nunca se pierden

### **Control de datos:**
- No usamos tus datos para nada más
- No se comparten con terceros
- No se pasan a IA

### **GDPR - Política de eliminación:**
```
Soft Delete (1 año):
├─ Usuario clica "Eliminar cliente"
├─ Cliente desaparece visualmente
└─ Datos guardados durante 1 año (recuperable)

Hard Delete (automático después 1 año):
├─ Cron automático elimina:
│   ├─ Datos personales (email, teléfono, dirección)
│   ├─ Cliente y contratos
│   └─ Clases asociadas
├─ Pero MANTIENE:
│   ├─ Pagos (necesarios para impuestos)
│   └─ Facturas (auditoría fiscal)
└─ Usuario puede recuperar dentro del año
```

---

## 📦 Stack Tecnológico

### Stack actual (en desarrollo)

El stack original contemplaba una app de escritorio con PyQt6 y móvil con Flutter. Durante el desarrollo se optó por una **web app** con React, decisión que cumple los mismos requisitos de seguridad y flexibilidad con ventajas adicionales: sin instalación, cross-platform por defecto, y stack más moderno y mantenible.

#### **Backend**
- **FastAPI** 0.115.0 — API RESTful asincrónica
- **PostgreSQL** — Base de datos principal (asyncpg como driver)
- **SQLAlchemy** 2.0 — ORM Python (async)
- **Alembic** — Migraciones de BD
- **Pydantic** 2.9 — Validación de datos y schemas
- **python-jose + bcrypt** — JWT y hashing de contraseñas
- **csv (stdlib)** — Parser de extractos bancarios (CSV Hello Bank)
- **Google Calendar API** — Integración sincronización de clases

#### **Frontend**
- **React** 18 + **TypeScript** — UI web
- **Vite** — Bundler y dev server
- **TailwindCSS** — Estilos
- **React Router** 6 — Navegación SPA
- **Vitest** + **@testing-library/react** — Tests unitarios

#### **Testing**
- Backend: **pytest** + **pytest-asyncio** + **httpx** + SQLite in-memory
- Frontend: **Vitest** + **@testing-library/react** + jsdom

---

### Stack objetivo (app final)

> Lo siguiente está planificado pero aún no implementado. Se mantiene como referencia de hacia dónde evoluciona la app.

#### **Backend (pendiente)**
- **APScheduler** — Tareas programadas (notificaciones automáticas)
- **WeasyPrint** — Generación de facturas en PDF
- **WhatsApp Business API** (vía n8n) — Notificaciones automáticas *(pendiente validación de coste)*

#### **Infraestructura (pendiente definir)**
- **Hosting**: DigitalOcean App Platform u equivalente
- **PostgreSQL Managed** — BD en producción
- **Docker** — Contenedores
- **Nginx** — Reverse proxy + HTTPS

#### **Fase 3: Móvil (futuro)**
- **Flutter** 3.0+ — iOS + Android

---

## 📋 Requisitos técnicos

### **Para usar la app**
- Windows 10+, macOS 10.14+, o Linux (Ubuntu 18+)
- Conexión a internet (para sincronización)
- Cuenta de Google (para Google Calendar)
- WhatsApp Business (para recordatorios)

### **Para desarrollar**
- Python 3.10+
- Git
- PostgreSQL 14+
- Docker (opcional, para desarrollo local)

---

## 🚀 Quick Start (Desarrollo)

```bash
# 1. Clonar repositorio
git clone <tu-repo-privado>
cd pulse-app

# 2. Setup Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con credenciales (DATABASE_URL, SECRET_KEY, Google OAuth, etc)

# 4. Inicializar BD
python -m alembic upgrade head

# 5. Ejecutar servidor (puerto 8001)
uvicorn main:app --reload --port 8001

# 6. Setup Frontend (en otra terminal)
cd ../frontend
pnpm install
pnpm dev   # Vite en http://localhost:5173, con proxy /api → backend

# Tests
cd backend && pytest            # backend
cd frontend && pnpm vitest run  # frontend
```

---

## 📅 Timeline estimado

### **Fase 1: MVP Base (4-6 semanas)**
```
Sprint 1: Setup backend, modelos BD, autenticación
Sprint 2: Frontend PyQt6 (clientes, clases, pagos)
Sprint 3: Testing, sincronización, backup
```

### **Fase 2: Automatización + Comunicación (4-5 semanas)**
```
Sprint 4: Statement Parser (CSV) + Reconciliación
Sprint 5: Alertas + Facturas
Sprint 6: Recordatorios
```

### **Fase 3: Móvil (8-10 semanas)**
```
Flutter app, sincronización, notificaciones
```

**TOTAL: 3-4 meses para versión completa**

---

## 📊 Base de datos - Esquema

```
TABLAS PRINCIPALES:

users
├─ id, email, password_hash, created_at

clients
├─ id, user_id, name, payment_name
├─ email, phone, address
├─ is_active, created_at, updated_at, deleted_at

contracts
├─ id, client_id, description
├─ start_date, end_date
├─ hourly_rate, is_active, notes
├─ created_at, updated_at, deleted_at

classes
├─ id, user_id, client_id, contract_id
├─ class_date, class_time, duration_hours
├─ hourly_rate (capturado en el momento)
├─ notes, google_calendar_id
├─ created_at, updated_at

payments
├─ id, user_id, client_id
├─ amount, payment_date, concept
├─ status, source (bank_import, manual, etc)
├─ created_at, updated_at

invoices
├─ id, user_id, client_id
├─ invoice_number, period
├─ total, created_at

notification_configs
├─ id, user_id
├─ enabled, hours_before, send_time
├─ channels (whatsapp, email), template

notification_log
├─ id, user_id, client_id, class_id
├─ channel, sent_at, status
├─ retry_count
```

---

## 🛠️ Troubleshooting

### **"No puedo conectar con servidor"**
- Verifica conexión a internet
- Comprueba si servidor está activo (DigitalOcean dashboard)
- Revisa variables de entorno (.env)

### **"Datos no sincronizados"**
- Backup local SQLite tiene tus datos
- Sincronización manual: Configuración → Sincronizar ahora
- Los datos nunca se pierden

### **"El extracto no se procesa correctamente"**
- Verifica que el CSV sea el export de Hello Bank/BNP Paribas
- Debe conservar las columnas originales (Date; Débit; Crédit; Libellé)
- Si falla, contacta soporte

### **"Google Calendar no actualiza"**
- Verifica permisos de Google Calendar
- Reautentica en Configuración
- La sincronización es cada 5 minutos

---

## 📈 Métricas de rendimiento

- **Tiempo de carga:** < 2 segundos (desktop)
- **Sincronización:** < 5 segundos (cambios)
- **Reportes:** < 3 segundos (1000+ registros)
- **Búsqueda avanzada:** < 1 segundo
- **Parsing extracto CSV:** < 1 segundo

---

## 🤝 Contribución

Este es un proyecto privado. Consulta con el propietario antes de cambios significativos.

---

## 📄 Licencia

Privado - Solo uso personal/comercial del propietario

---

## 📞 Contacto & Soporte

Para bugs o sugerencias, abre un issue en el repositorio privado de GitHub.

---

**Versión:** 0.1.0 (MVP)  
**Última actualización:** Marzo 2026  
**Estado:** En desarrollo activo  
**Próximo milestone:** Setup DigitalOcean + Estructura Backend
