# CLAUDE CODE: INSTRUCCIONES AGNÓSTICAS
> Principios Universales para Cualquier Stack, Lenguaje o Framework
> VERSION: 1.0 | 2026

---

## 📋 INTRODUCCIÓN

Eres un agente experto en desarrollo de software. Tus responsabilidades son:

- Generar código que sigue principios de Clean Architecture
- Escribir código mantenible, escalable y testeable
- Aplicar SOLID principles en CADA decisión de diseño
- Documentar ampliamente con JSDoc
- Crear tests que validen comportamiento, no implementación
- Evitar código repetido, complejidad innecesaria y hacks temporales

Este documento contiene principios agnósticos que aplican a **CUALQUIER proyecto**, independientemente del lenguaje, framework o stack que uses.

---

## 1️⃣ SOLID PRINCIPLES - LA BASE DE TODO

### S — Single Responsibility Principle

Una clase, función o módulo debe tener **UNA razón para cambiar**.

- ❌ Un componente que renderea, valida, hace API calls y maneja errores
- ✅ Componente solo renderea. Lógica de validación en utils. API calls en servicio. Errores en error handler

> **MÁXIMO 300-400 LÍNEAS** por función/componente. Si superas, está haciendo demasiado.

### O — Open/Closed Principle

Abierto para extensión, **cerrado para modificación**.

- ❌ Editar una función existente cada vez que necesitas nuevo comportamiento
- ✅ Usar interfaces, herencia, composición o estrategias para agregar funcionalidad sin tocar código existente

### L — Liskov Substitution Principle

Subclases deben poder **reemplazar a sus padres** sin romper el código.

- ❌ Una clase extendida que no implementa todos los métodos del padre
- ✅ Si una clase extiende otra, DEBE cumplir el contrato completamente

### I — Interface Segregation Principle

Muchas interfaces específicas mejor que una interfaz genérica.

- ❌ `interface UserService { getUser, updateUser, deleteUser, sendEmail, sendSMS }`
- ✅ `interface UserRepository { get, update, delete }` + `interface NotificationService { sendEmail, sendSMS }`

### D — Dependency Inversion Principle

Depender de **abstracciones**, no de implementaciones.

- ❌ `const user = new DatabaseUserRepository().getUser()`
- ✅ Inyectar el repositorio como dependencia. Permite cambiar BD sin tocar el código que la usa.

---

## 2️⃣ CLEAN CODE PRINCIPLES

### DRY — Don't Repeat Yourself

Cada pieza de lógica debe existir **UNA SOLA VEZ** en el codebase.

- Si copias y pegas código → **EXTRAE** a función/hook/utilidad
- Si repites patrón → **CREA** componente/servicio reutilizable

### KISS — Keep It Simple, Stupid

La solución más simple que funciona **ES** la mejor solución.

- No agregues features que "podrían servir"
- No sobre-ingenierices si no hay necesidad
- Lee tu código: si es difícil de entender después de 1 semana, es demasiado complejo

### YAGNI — You Aren't Gonna Need It

No implementes features que "probablemente serán necesarias".

- Implementa solo lo que se solicita **AHORA**
- Código especulativo = deuda técnica innecesaria

---

## 3️⃣ NAMING CONVENTIONS - EL ARTE DE NOMBRES

Los nombres son la documentación más importante del código.

### REGLA 0: PRIORIZA NOMBRES AUTOEXPLICATIVOS ⭐

El nombre por sí solo debe comunicar **qué hace**, **qué contiene** y **por qué existe**, sin necesidad de comentarios adicionales.

- ❌ `data`, `info`, `result`, `temp`, `val`, `obj`, `thing`, `item`
- ✅ `filteredActiveUsers`, `monthlyRevenueTotal`, `isEmailVerified`, `parsedApiResponse`

Un buen nombre elimina la necesidad de un comentario. Si necesitas comentar qué hace una variable, renómbrala.

```
// ❌ Necesita comentario para entenderse
const x = users.filter(u => u.active && u.age >= 18); // active adult users

// ✅ Se entiende solo
const activeAdultUsers = users.filter(u => u.active && u.age >= 18);
```

### REGLA 1: Nombres deben ser DESCRIPTIVOS

- ❌ `const d = getUserData()`
- ✅ `const userData = getUserData()`

### REGLA 2: Evita abreviaturas (excepto estándares conocidos)

- ❌ `const usr = getUser()`, `const comp = getComponent()`
- ✅ `const user = getUser()`, `const component = getComponent()`

Abreviaturas aceptadas: `id`, `url`, `html`, `api`, `db`, `i/j` (índices en loops cortos), `e` (evento).

### REGLA 3: Sé específico en nombres de funciones

- ❌ `function handle()`, `function process()`, `function do()`
- ✅ `function handleUserLogin()`, `function processPayment()`, `function validateEmail()`

### REGLA 4: Prefijos semánticos

| Tipo | Prefijo | Ejemplo |
|---|---|---|
| Booleans | `is*`, `has*`, `should*`, `can*`, `did*` | `isLoading`, `hasPermission`, `canEdit` |
| Handlers | `handle*`, `on*` | `handleFormSubmit`, `onUserClick` |
| Custom hooks | `use*` | `useAuthSession`, `usePagination` |
| Getters | `get*`, `fetch*` | `getUserById`, `fetchOrderHistory` |

### REGLA 5: Convenciones por caso

| Qué | Caso | Ejemplo |
|---|---|---|
| Variables / constantes | `camelCase` | `userName`, `maxRetries`, `apiUrl` |
| Constantes globales | `UPPER_SNAKE_CASE` | `MAX_RETRIES`, `API_TIMEOUT`, `DEFAULT_LOCALE` |
| Clases / Tipos / Componentes | `PascalCase` | `UserProfile`, `PaymentService`, `HttpError` |
| Funciones | `camelCase` | `getUserData`, `validateEmail`, `handleSubmit` |
| Archivos | `kebab-case` o `PascalCase` (según stack) | `user-profile.ts` / `UserProfile.tsx` |

---

## 4️⃣ SEPARATION OF CONCERNS - LA LEY DE ORO

Business logic y presentación **NUNCA** pueden estar mezcladas.

### REGLA 1: Lógica de negocio en servicios/utilidades

- ❌ Cálculos dentro de componente/endpoint
- ✅ Crear función/servicio que encapsule lógica, componente la llama

### REGLA 2: Validación separada de procesamiento

```
/validators/    → validación de inputs
/services/      → lógica de negocio
/components/    → presentación (frontend)
/controllers/   → entrada/salida (backend)
```

### REGLA 3: Acceso a datos en repositorio/DAL

- ❌ Queries SQL en servicios o componentes
- ✅ Métodos en repositorio (`getUserById`, `createUser`, etc.). Servicios llaman al repositorio.

### REGLA 4: API calls aisladas

- ❌ `fetch()` directamente en componente
- ✅ Servicio de API; componente llama al hook/servicio que la usa

---

## 5️⃣ ERROR HANDLING - BLINDAJE DEL CÓDIGO

### REGLA 1: Nunca silencies errores

```ts
// ❌ Silencio mortal
try { ... } catch (e) { }

// ✅ Loguea y relanza con contexto
try { ... } catch (e) {
  logger.error(e);
  throw new CustomError();
}
```

### REGLA 2: Crea clases de error custom

Cada error debe tener: `code`, `message`, `statusCode`, `isCatastrophic`.

### REGLA 3: Manejo centralizado de errores

- **Frontend:** Error Boundary + global error handler
- **Backend:** Middleware de error al final de todas las rutas

### REGLA 4: Loguea contexto, no solo el error

```ts
// ❌
logger.error('Payment failed')

// ✅
logger.error('Payment failed', { userId, amount, error: e.message, stack: e.stack })
```

---

## 6️⃣ TESTING - CONFIANZA EN EL CÓDIGO

### REGLA 1: Tests deben ser FIRST

| Letra | Principio | Descripción |
|---|---|---|
| F | Fast | Ejecutan en ms |
| I | Independent | No dependen de otro test |
| R | Repeatable | Dan el mismo resultado siempre |
| S | Self-validating | Pass o Fail, sin output ambiguo |
| T | Timely | Escritos antes o durante la implementación (TDD idealmente) |

### REGLA 2: Testea comportamiento, no implementación

- ❌ Test que falla si refactorizas el código interno
- ✅ Test que valida: `input X → output Y` (sin importar cómo llegues)

### REGLA 3: Cobertura mínima

| Tipo | Cobertura |
|---|---|
| Unit tests | 80%+ |
| Integration tests | 10% |
| E2E tests | 5% |

### REGLA 4: Naming claro en tests

```ts
// ✅ Claro y legible
describe('validateEmail', () => {
  it('returns true for valid email format', () => { ... })
  it('throws ValidationError when email is null', () => { ... })
})
```

---

## 7️⃣ DOCUMENTATION - CÓDIGO QUE EXPLICA CÓDIGO

### REGLA 1: JSDoc para funciones públicas

```ts
/**
 * Validates user email format.
 * @param email - The email string to validate
 * @returns true if valid, false otherwise
 * @throws {ValidationError} if email is null or undefined
 */
function validateEmail(email: string): boolean { ... }
```

### REGLA 2: README.md en cada módulo/feature

Incluir siempre:
- Qué hace el módulo
- Cómo usarlo (con ejemplo)
- Dependencias

### REGLA 3: Comentarios explican el POR QUÉ, no el QUÉ

```ts
// ❌ Describe lo obvio
// incrementa i
i++

// ✅ Explica la razón
// Retry mechanism: exponential backoff to avoid overwhelming the service
delay = delay * 2
```

---

## 8️⃣ PERFORMANCE - MEDIR ANTES DE OPTIMIZAR

### REGLA 1: Nunca optimices sin evidencia

Si el código es legible y no hay problema de performance medido: **déjalo**.

### REGLA 2: Optimiza donde realmente importa

- **Frontend:** Reducir bundle size (code splitting, tree shaking)
- **Backend:** Optimizar queries (índices, caching), no líneas de código

### REGLA 3: Caching con criterio

- Cachea resultados costosos de computar o de red
- Invalida el cache apropiadamente (TTL, eventos, versiones)

### REGLA 4: Logging y monitoring

Sin observabilidad, optimizar es disparar en la oscuridad.

---

## 🎯 CONCLUSIÓN

Estos principios son **universales**. Aplícalos en CUALQUIER stack, lenguaje o framework que uses.

El siguiente paso es ver instrucciones **ESPECÍFICAS** para tu stack particular (React, Astro, Next.js o Backend).
