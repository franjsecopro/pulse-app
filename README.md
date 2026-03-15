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
- **Parser automático de PDF bancario** (Hello Bank/BNP Paribas)
  - Extrae ingresos del estado de cuenta
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
│  ├─ Upload PDF banco            │     └─ Alertas             │
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
                    │  ├─ PDF Parser (pdfplumber) │
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
  ├─ payment_name: str      # Para matching con PDF ("García")
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

### **1. Importación de pagos (PDF)**
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
  ├─ Total pagado (del PDF o manual)
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

### **4. Recordatorios automáticos**
```
APScheduler cada 24h:
  ├─ Chequea clases de mañana
  ├─ Para cada clase, obtiene cliente
  ├─ Si recordatorios habilitados:
  │   ├─ Obtiene configuración (horas antes, hora envío)
  │   ├─ Si es hora correcta → envía WhatsApp
  │   └─ Registra en historial
  └─ Retry automático si falla
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

### **Encriptación:**
- **AES-256** en reposo (datos en PostgreSQL)
- **HTTPS/TLS** en tránsito (cliente-servidor)
- **End-to-end:** Solo tú puedes desencriptar tus datos

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

### **Backend**
- **FastAPI** 0.104.1 - API RESTful asincrónica
- **PostgreSQL** - Base de datos robusta, escalable
- **SQLAlchemy** 2.0 - ORM Python
- **Pydantic** 2.5 - Validación de datos
- **Cryptography** - Encriptación AES-256
- **pdfplumber** 0.10 - Parser de PDFs
- **WeasyPrint** 59.0 - Generación de PDFs (HTML → PDF)
- **APScheduler** 3.10 - Tareas programadas
- **Google Auth** - Integración Google Calendar
- **Twilio** - WhatsApp Business API

### **Frontend Desktop**
- **PyQt6** 6.6 - GUI nativa multiplataforma
- **Requests** - Cliente HTTP
- **SQLite** - Backup local

### **Frontend Móvil (Fase 3)**
- **Flutter** 3.0+ - iOS + Android

### **Infraestructura**
- **DigitalOcean App Platform** - Hosting (€12-27/mes)
- **PostgreSQL Managed** - BD (€15/mes)
- **Docker** - Contenedores
- **Nginx** - Reverse proxy + HTTPS
- **Git/GitHub** - Control de versiones (privado)

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
cd gestor-contabilidad

# 2. Setup Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con credenciales (Google, WhatsApp, BD, etc)

# 4. Inicializar BD
python -m alembic upgrade head

# 5. Ejecutar servidor
uvicorn main:app --reload

# 6. Setup Frontend (en otra terminal)
cd ../desktop
pip install -r requirements.txt
python main.py
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
Sprint 4: PDF Parser + Reconciliación
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

### **"PDF no se procesa correctamente"**
- Verifica que PDF sea de Hello Bank/BNP Paribas
- Formato debe ser "Relevé de compte" estándar
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
- **Parsing PDF:** < 10 segundos (documentos de 50 páginas)

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
