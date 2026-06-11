# Contexto del Proyecto — "Chief of Staff"

> Documento de contexto para reutilizar en otras herramientas y crear nuevos prompts.
> No contiene detalles de código ni de archivos: solo de qué se trata el proyecto.

---

## 1. Qué es

Una aplicación web personal que funciona como **"Chief of Staff" (jefe de gabinete)** de Martín.
En la práctica es un **tablero de tareas tipo kanban** para coordinar el trabajo de su equipo
directo, con **avisos automáticos por Telegram** cada vez que pasa algo importante.

La idea central: Martín reparte tareas, ve de un vistazo qué está haciendo cada persona,
y recibe notificaciones sin tener que estar revisando el tablero todo el día.

## 2. Para quién y por qué

- **Usuario principal:** Martín, Gerente (CEO) de **Promotora Nivel**, empresa inmobiliaria
  con operación en **Colombia** y un **portafolio de renta en Estados Unidos**.
- **Problema que resuelve:** Martín necesita un lugar único para asignar y seguir tareas de su
  equipo, sin depender de mensajes sueltos de WhatsApp/correo, y enterarse a tiempo cuando algo
  se atrasa.
- **Filosofía de uso:** simple, en español, pensado para alguien **no técnico**. Las decisiones
  se explican en lenguaje sencillo.

## 3. El equipo (5 personas)

Cada persona tiene un área de responsabilidad. El tablero tiene una columna por persona.

| Persona | Área principal |
|---|---|
| **Camila Arbeláez** | Finanzas, tesorería, banca, temas jurídicos |
| **Juan Esteban Vásquez** | Proyectos, licencias, trámites de obra |
| **Laura Isaza** | Inmobiliario USA, renta, procesos |
| **Natalia Burgos** | Comercial Colombia, ventas |
| **Steven Cadavid** | Relaciones externas, inversionistas |

## 4. Qué hace la aplicación (funciones)

1. **Tablero kanban** con una columna por cada persona del equipo. Cada tarea es una tarjeta que
   muestra título, prioridad (alta/media/baja), estado y fecha límite.
2. **Crear nueva tarea** con un formulario. Al escribir el título y la descripción, el sistema
   **sugiere automáticamente a quién asignarla** según el área de cada persona.
3. **Detalle de cada tarea**, donde se puede **cambiar el estado** (nueva → en progreso →
   bloqueada → completada) y **agregar notas** de seguimiento.
4. **Avisos por Telegram** automáticos en tres momentos:
   - cuando se **crea** una tarea nueva,
   - cuando una tarea **cambia de estado**,
   - cuando una tarea lleva **demasiado tiempo sin moverse** (atrasada).
5. **Detector de atrasos automático:** revisa periódicamente y avisa por Telegram las tareas que
   llevan más de 6 horas sin movimiento.
6. **Pantalla de configuración** (solo lectura) que muestra el estado de las conexiones
   (Telegram y base de datos).

## 5. Estados y prioridades

- **Prioridad:** Alta · Media · Baja
- **Estado:** Nueva · En progreso · Bloqueada · Completada

## 6. Cómo está montado (a grandes rasgos, sin tecnicismos)

- Es una **app web** que corre en el computador de Martín (en `localhost`, es decir, en su propia
  máquina, no publicada en internet).
- Guarda las tareas en una **base de datos en la nube**.
- Envía los avisos a un **bot de Telegram** (solo envía mensajes, no recibe comandos).
- **No tiene usuarios ni contraseñas** porque está pensada para uso local de una sola persona.

## 7. Estado actual

- Funciona de punta a punta: crear tareas, moverlas, recibir avisos por Telegram, sugerencia de
  asignación, y detector de atrasos.
- El código está respaldado en un repositorio de GitHub.
- Es un **proyecto lateral / experimento**; puede que se rehaga sobre una infraestructura nueva
  más adelante.

## 8. Ideas / próximos pasos pensados

- **Sugerencia más inteligente:** hoy la app sugiere a quién asignar una tarea buscando palabras
  clave. La idea futura es reemplazar eso por **inteligencia artificial (Claude)** para que la
  sugerencia entienda mejor el contexto.
- **Publicarla en internet** (por ejemplo en Vercel) para no depender de tener el computador
  encendido — pendiente de decidir, porque implicaría resolver el tema de seguridad/acceso.

---

*Documento de contexto. Para usarlo como insumo al redactar nuevos prompts o briefs.*
