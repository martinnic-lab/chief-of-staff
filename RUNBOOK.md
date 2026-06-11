# RUNBOOK — Sincronización con Microsoft Planner

Guía de operación en lenguaje sencillo. Acá está todo lo que necesitás para
prender el sistema, aprobar cambios y entender cada alerta.

---

## La idea en una frase

**Planner manda en las tareas; esta capa observa, enriquece y avisa.**
El sistema lee tu plan de Planner cada 5 minutos y copia las tareas a tu base
de datos (Neon). Nunca escribe nada en Planner sin tu aprobación explícita.

---

## 1. Configuración inicial (una sola vez)

### 1a. Registrar la aplicación en Azure (paso a paso)

Esto le da permiso al sistema para hablar con Planner **en tu nombre**.
Tardás unos 5 minutos:

1. Entrá a **https://portal.azure.com** con tu cuenta Microsoft de la empresa.
2. En el buscador de arriba escribí **"App registrations"** (registros de
   aplicaciones) y entrá.
3. Botón **"+ New registration"**:
   - **Name:** `chief-of-staff-sync` (o el nombre que quieras)
   - **Supported account types:** dejá la primera opción
     ("Accounts in this organizational directory only").
   - **Redirect URI:** dejalo vacío.
   - Botón **Register**.
4. En la pantalla que aparece, copiá dos códigos (los vas a pegar en `.env.local`):
   - **Application (client) ID** → es tu `AZURE_CLIENT_ID`
   - **Directory (tenant) ID** → es tu `AZURE_TENANT_ID`
5. Menú izquierdo → **Authentication**:
   - Bajá hasta **"Allow public client flows"** y ponelo en **Yes** → **Save**.
   - (Esto habilita el login por código que usa el sistema.)
6. Menú izquierdo → **API permissions** → **+ Add a permission** →
   **Microsoft Graph** → **Delegated permissions**:
   - Buscá y marcá **Tasks.ReadWrite**
   - Buscá y marcá **User.ReadBasic.All**
   - Botón **Add permissions**.
7. Listo. (Si tu organización exige "admin consent", el botón
   **"Grant admin consent"** está en esa misma pantalla — como Gerente
   probablemente puedas dárselo vos mismo o pedirlo a quien administre el
   Microsoft 365.)

> **¿Por qué permisos "delegados" y no "de aplicación"?** Delegado = el
> sistema actúa **como vos**, solo ve lo que vos ves, y cada cambio en
> Planner queda registrado a tu nombre. "De aplicación" le daría acceso a
> TODOS los planes de TODA la empresa sin usuario — innecesario y más
> riesgoso para una capa personal sobre un solo plan.

### 1b. Encontrar el ID de tu plan de Planner

1. Abrí tu plan en el navegador (planner.cloud.microsoft o Teams → Planner).
2. Mirá la dirección (URL): contiene algo como `/plan/XXXXXXXXXXXXXXXXXXXXXXXXXXXX`
   o `planId=XXXX...`. Ese código largo es tu `PLANNER_PLAN_ID`.

### 1c. Completar `.env.local`

Copiá `.env.example` como `.env.local` (si no existe ya) y completá:
`AZURE_TENANT_ID`, `AZURE_CLIENT_ID` y `PLANNER_PLAN_ID`.
(Las claves de Neon y Telegram ya las tenés de antes.)

### 1d. Aplicar las migraciones de base de datos

```
npm run db:migrar
```

Crea las tablas nuevas si faltan (es seguro correrlo las veces que sea).

### 1e. Conectar el ID de Planner de cada persona

Cuando el sistema vea una tarea asignada a alguien que no reconoce, te
avisa por Telegram con el nombre (flag `unknown_person`). Para resolverlo,
guardá ese ID en la persona correcta de la tabla `people`
(columna `planner_user_id`). Se hace una sola vez por persona.

---

## 2. Operación diaria

### Prender el servicio

```
npm run sync
```

- **La primera vez** te va a mostrar un mensaje tipo:
  *"To sign in, use a web browser to open https://microsoft.com/devicelogin
  and enter the code XXXX-XXXX"*. Hacé eso con tu cuenta Microsoft y listo.
  Las siguientes veces entra solo (guarda la sesión en `.msal-cache.json`).
- Dejá la ventana abierta: sincroniza cada 5 minutos y va mostrando un
  resumen por ciclo.
- Para pararlo: `Ctrl+C`.

### Aprobar cambios de título (la única escritura que existe)

Cuando una tarea ya tiene proyecto asignado, el sistema propone renombrarla
en Planner al formato `[Proyecto] Título limpio` y te avisa por Telegram.
**Nada se escribe hasta que vos digas que sí:**

```
npm run aprobar                    ← ver qué hay pendiente (antes / después)
npm run aprobar -- 3fa8            ← aprobar UNA (las primeras letras del id bastan)
npm run aprobar -- todas           ← aprobar todo lo pendiente
npm run aprobar -- rechazar 3fa8   ← descartar una propuesta
```

Todo lo aprobado queda en la bitácora (`sync_log`) marcado como
**aprobado por humano**.

---

## 3. Qué significa cada alerta de Telegram

| Mensaje | Qué pasó | Qué hacer |
|---|---|---|
| 🚩 *Persona desconocida en Planner...* | Una tarea está asignada a alguien que no está en tu tabla de equipo | Agregar/conectar a la persona (`planner_user_id`) o resolver el flag |
| 🖊 *N título(s) esperando tu aprobación* | El sistema propone renombrar tareas al formato `[Proyecto] ...` | Correr `npm run aprobar` y decidir |
| ⚠️ *Tarea sin movimiento +6h* | Una tarea no completada lleva más de 6 horas sin ningún cambio en Planner | Empujarla con el responsable (el aviso no se repite antes de 24 h) |
| ✅ *Aprobaste N cambio(s)...* | Confirmación: tus aprobaciones ya quedaron aplicadas en Planner | Nada — es solo confirmación |

---

## 4. Si algo falla

- **"Falta AZURE_..." al arrancar** → revisá el paso 1c (`.env.local`).
- **Pide login otra vez** → normal si pasaron muchos días sin usarlo;
  repetí el código y sigue solo.
- **"Ciclo falló" repetido en consola** → suele ser internet o permisos;
  el detalle queda en consola y en la tabla `sync_log`.
- **Borrar la sesión Microsoft** → borrá el archivo `.msal-cache.json`
  y volvé a correr `npm run sync` (te pedirá login de nuevo).

---

## 5. Reglas de oro del sistema

1. **Planner es la fuente de verdad** del estado, asignado y fecha de cada tarea.
2. **Neon es la fuente de verdad** de los proyectos y del contexto del equipo.
3. **Leer es automático; escribir requiere tu aprobación.** Sin excepciones.
4. Todo contacto con Microsoft queda en la bitácora `sync_log`.
