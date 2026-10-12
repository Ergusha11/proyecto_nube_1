# Formulario en la nube — Arquitectura del proyecto

**Materia:** Cómputo en la nube · **Unidad II:** Configuración e implantación de una nube
**Proyecto:** Parcial 01 — Formulario en la nube · ESCOM (IPN)

**Stack:** HTML5 + CSS3 + JavaScript (vanilla) · PHP 8.3 (mod_php) · Apache 2.4 · PostgreSQL 16 · Docker Compose
**Infraestructura:** 1 VM Linux en Azure (región México) con todo el stack contenerizado

---

## 1. Resumen

Un formulario web (el cuestionario de la actividad sumativa 04, **"Evaluación de Modelo de Infraestructura TI"**, archivo `Evaluación_TI.pdf`) con diseño institucional ESCOM. El navegador envía los datos por `fetch` a un endpoint PHP, que valida y guarda la información en PostgreSQL. Todo corre en contenedores dentro de una VM de Azure.

### 1.1 Cuestionario

El formulario reproduce **exactamente** las 16 preguntas del PDF (mismo orden y mismo texto). **No se piden datos personales** (ni nombre, ni correo, ni boleta), tal como indica el aviso del formulario original:

> *Cuando envíe este formulario, no recopilará automáticamente sus detalles, como el nombre y la dirección de correo electrónico, a menos que lo proporcione usted mismo.*

Hay dos tipos de pregunta y **todas tienen 5 posibles respuestas**, por lo que cada respuesta se guarda como un entero `1..5`:

| Tipo | Preguntas | Control en HTML | Valor guardado |
|---|---|---|---|
| `opcion` (opción única) | 1, 2, 3, 6, 7, 8, 10 | 5 `radio` con el texto de cada opción | posición de la opción (1 = primera) |
| `escala` (estrellas) | 4, 5, 9, 11, 12, 13, 14, 15, 16 | 5 `radio` con forma de estrella | número de estrellas |

En las preguntas de escala, la leyenda del PDF es: *1 estrella: Totalmente en desacuerdo · 5 estrellas : Totalmente de acuerdo*.

El texto exacto de cada pregunta y de cada opción está en `db/init/02_preguntas.sql` (§5.2). Esa es la **única fuente de verdad**: el HTML debe coincidir con ella.

> **Supuesto:** el PDF no indica qué preguntas son obligatorias; se asume que **las 16 son obligatorias** (columna `preguntas.obligatoria`, fácil de cambiar).

## 2. Arquitectura lógica

Alineada con el diagrama del enunciado (Vista → Servicios → Procesamiento → Almacenamiento):

```
 Capa Vista            Servicios (nube)           Procesamiento              Almacenamiento
┌────────────┐      ┌──────────────────────┐   ┌─────────────────────┐    ┌──────────────┐
│ Navegador  │ 80/  │ Azure VM (Ubuntu)    │   │ Apache 2.4 + PHP    │    │ PostgreSQL   │
│ (PC/móvil) ├─443─►│ + NSG (firewall)     ├──►│ HTML/CSS/JS estático│───►│ (volumen     │
│ HTML+CSS+JS│      │ + IP pública / VNet  │   │ /api/*.php (PDO)    │    │  persistente)│
└────────────┘      └──────────────────────┘   └─────────────────────┘    └──────────────┘
                                                  red docker interna ─────────────┘
```

### Contenedores (Docker Compose)

| Servicio | Imagen | Puerto host | Función |
|---|---|---|---|
| `web` | `php:8.3-apache` (+ `pdo_pgsql`) | 80 (y 443) | Apache sirve los estáticos y ejecuta PHP con `mod_php` |
| `db` | `postgres:16-alpine` | **No expuesto** | Base de datos, volumen persistente |

Reglas: la BD **solo** es accesible desde la red interna de Docker; solo `web` publica puertos. PHP solo se ejecuta dentro de `/api`.

## 3. Estructura del repositorio

```
formulario-nube/
├── docker-compose.yml
├── .env.example               # plantilla (el .env real NO se sube a git)
├── .gitignore
├── web/
│   ├── Dockerfile
│   ├── 000-default.conf    # VirtualHost de Apache
│   ├── security.conf       # cabeceras y endurecimiento
│   └── custom.ini          # ajustes de PHP
├── db/
│   └── init/                  # se ejecuta al crear el volumen por primera vez (orden alfabético)
│       ├── 01_schema.sql      # tablas, índices, vista
│       └── 02_preguntas.sql   # las 16 preguntas y sus opciones (texto exacto del PDF)
├── src/
│   ├── public/                # raíz web (document root)
│   │   ├── index.html
│   │   ├── gracias.html
│   │   ├── assets/
│   │   │   ├── css/styles.css
│   │   │   ├── js/form.js
│   │   │   └── img/           # logos ESCOM / IPN
│   │   └── api/
│   │       ├── csrf.php       # GET: entrega token
│   │       └── submit.php     # POST: valida y guarda
│   └── app/                   # código PHP NO público
│       ├── config.php
│       ├── Database.php
│       ├── Validator.php
│       └── Response.php
└── docs/
    └── evidencias/            # capturas para el entregable
```

## 4. Contrato de la API

### `GET /api/csrf.php`
Respuesta `200`:
```json
{ "token": "a1b2c3..." }
```
Guarda el token en la sesión PHP (cookie `HttpOnly`, `SameSite=Strict`).

### `POST /api/submit.php`
Headers: `Content-Type: application/json`, `X-CSRF-Token: <token>`

Body: las 16 respuestas, clave `p1`…`p16`, valor entero `1..5` (ver §1.1).
```json
{
  "respuestas": {
    "p1": 2,  "p2": 3,  "p3": 2,  "p4": 5,
    "p5": 4,  "p6": 1,  "p7": 3,  "p8": 2,
    "p9": 4,  "p10": 3, "p11": 5, "p12": 2,
    "p13": 4, "p14": 1, "p15": 3, "p16": 4
  },
  "website": ""
}
```
Ejemplo de lectura: `"p1": 2` = *11-50* empleados; `"p4": 5` = 5 estrellas (*Totalmente de acuerdo*).

`website` es un **honeypot** (debe ir vacío). No hay campos de datos personales.

| Código | Cuándo | Cuerpo |
|---|---|---|
| `201` | Guardado correcto | `{ "ok": true, "id": 42 }` |
| `400` | JSON inválido | `{ "ok": false, "error": "bad_request" }` |
| `403` | CSRF inválido/ausente | `{ "ok": false, "error": "csrf" }` |
| `405` | Método distinto de POST | `{ "ok": false, "error": "method" }` |
| `422` | Falla validación | `{ "ok": false, "errors": { "p3": "Selecciona una opción", "p9": "Valor fuera de rango" } }` |
| `429` | Demasiadas peticiones | `{ "ok": false, "error": "rate_limit" }` |
| `500` | Error interno | `{ "ok": false, "error": "server" }` (sin detalles) |

## 5. Modelo de datos (PostgreSQL)

Diseño normalizado: un catálogo de preguntas con sus opciones, un registro por envío (anónimo) y sus respuestas. Las preguntas de escala también tienen 5 filas en `opciones`, así **una sola llave foránea** garantiza que toda respuesta sea una opción válida de su pregunta.

```
respondientes 1───N respuestas N───1 opciones N───1 preguntas
```

### 5.1 `db/init/01_schema.sql`
```sql
-- Un registro por envío. Anónimo: no se guarda nombre, correo ni IP en claro.
CREATE TABLE IF NOT EXISTS respondientes (
    id          BIGSERIAL PRIMARY KEY,
    ip_hash     CHAR(64)    NOT NULL,           -- SHA-256(IP + IP_SALT), solo para el límite de frecuencia
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_respondientes_ip_fecha ON respondientes (ip_hash, creado_en);

CREATE TABLE IF NOT EXISTS preguntas (
    id          SMALLINT PRIMARY KEY CHECK (id > 0),   -- = número de pregunta en el PDF (1..16); en la API: "p" || id
    enunciado   TEXT     NOT NULL,
    ayuda       TEXT,                                  -- leyenda de la escala de estrellas
    tipo        VARCHAR(10) NOT NULL CHECK (tipo IN ('opcion','escala')),
    obligatoria BOOLEAN  NOT NULL DEFAULT TRUE,
    activa      BOOLEAN  NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS opciones (
    pregunta_id SMALLINT NOT NULL REFERENCES preguntas(id) ON DELETE CASCADE,
    valor       SMALLINT NOT NULL CHECK (valor BETWEEN 1 AND 5),  -- posición de la opción / nº de estrellas
    etiqueta    TEXT     NOT NULL,
    PRIMARY KEY (pregunta_id, valor)
);

CREATE TABLE IF NOT EXISTS respuestas (
    respondiente_id BIGINT   NOT NULL REFERENCES respondientes(id) ON DELETE CASCADE,
    pregunta_id     SMALLINT NOT NULL,
    valor           SMALLINT NOT NULL,
    PRIMARY KEY (respondiente_id, pregunta_id),
    FOREIGN KEY (pregunta_id, valor) REFERENCES opciones (pregunta_id, valor)
);
CREATE INDEX IF NOT EXISTS idx_respuestas_pregunta ON respuestas (pregunta_id, valor);

-- Resultados agregados (útil para evidencias): cuántas veces se eligió cada opción
CREATE OR REPLACE VIEW resumen_respuestas AS
SELECT p.id AS pregunta, o.valor, o.etiqueta, COUNT(r.respondiente_id) AS total
FROM preguntas p
JOIN opciones o        ON o.pregunta_id = p.id
LEFT JOIN respuestas r ON r.pregunta_id = o.pregunta_id AND r.valor = o.valor
GROUP BY p.id, o.valor, o.etiqueta
ORDER BY p.id, o.valor;

-- Usuario de aplicación con mínimo privilegio (no usar el superusuario desde PHP)
-- Se crea desde el entrypoint o manualmente: ver sección de despliegue.
```

### 5.2 `db/init/02_preguntas.sql` (texto exacto del PDF)
```sql
INSERT INTO preguntas (id, tipo, enunciado) VALUES
 (1,  'opcion', '¿Cuántos empleados tiene la empresa?'),
 (2,  'opcion', '¿Cuál es el presupuesto anual aproximado destinado a infraestructura de TI (MXN)?'),
 (3,  'opcion', '¿Cuántas personas del área de TI tienen capacidad para administrar y mantener servidores?'),
 (4,  'escala', 'La información que maneja la empresa está sujeta a regulaciones estrictas (datos personales, financieros, de salud o gubernamentales)'),
 (5,  'escala', 'Es indispensable que la infraestructura sea de uso exclusivo de la empresa, sin compartir recursos físicos con terceros.'),
 (6,  'opcion', '¿Qué porcentaje de sus datos NO puede salir de sus instalaciones o del país por política interna o por ley?'),
 (7,  'opcion', '¿Qué porcentaje de su carga de trabajo varía de forma impredecible (picos de demanda) durante el año?'),
 (8,  'opcion', '¿Cuál es la latencia máxima tolerable para sus aplicaciones críticas?'),
 (9,  'escala', 'Una degradación del rendimiento causada por otros usuarios que comparten la misma infraestructura afectaría gravemente nuestra operación.'),
 (10, 'opcion', '¿En cuánto tiempo estima que su demanda de cómputo se duplicará?'),
 (11, 'escala', 'La empresa prefiere pagar por consumo mensual (OPEX) antes que invertir capital en hardware propio (CAPEX).'),
 (12, 'escala', 'La empresa está dispuesta a asumir los costos de mantenimiento, actualización y personal necesarios para operar su propia infraestructura.'),
 (13, 'escala', 'La rapidez para desplegar nuevos servicios es más importante que tener control total sobre la infraestructura.'),
 (14, 'escala', 'La empresa ya cuenta con un centro de datos o infraestructura propia en operación que desea seguir aprovechando.'),
 (15, 'escala', 'La empresa comparte proyectos, normativas o requisitos de seguridad con otras organizaciones del mismo sector con las que podría compartir una infraestructura común.'),
 (16, 'escala', 'La empresa necesita mover datos y aplicaciones entre su infraestructura interna y servicios externos según la carga de trabajo.');

UPDATE preguntas
   SET ayuda = '1 estrella: Totalmente en desacuerdo' || chr(10) || '5 estrellas : Totalmente de acuerdo'
 WHERE tipo = 'escala';

-- Opciones de las preguntas de opción única (en el orden del PDF)
INSERT INTO opciones (pregunta_id, valor, etiqueta) VALUES
 (1, 1, '1-10'), (1, 2, '11-50'), (1, 3, '51-250'), (1, 4, '251-1000'), (1, 5, 'Mas de 1000'),
 (2, 1, 'Menos de 100,000 MXN'), (2, 2, '100,000–500,000 MXN'), (2, 3, '500,001–2,000,000 MXN'),
   (2, 4, '2,000,001–10,000,000 MXN'), (2, 5, 'Más de 10,000,000 MXN'),
 (3, 1, 'Ninguna'), (3, 2, '1-3'), (3, 3, '4-10'), (3, 4, '11-30'), (3, 5, 'Más de 30'),
 (6, 1, '0%'), (6, 2, '1-25%'), (6, 3, '26-50%'), (6, 4, '51-75%'), (6, 5, '76-100%'),
 (7, 1, '0-20'), (7, 2, '21–40%'), (7, 3, '41–60%'), (7, 4, '61-80%'), (7, 5, '81-100%'),
 (8, 1, 'Menos de 10ms'), (8, 2, '10-50 ms'), (8, 3, '51-200 ms'), (8, 4, 'Mas de 200 ms'), (8, 5, 'No es un factor critico'),
 (10, 1, 'Menos de 6 meses'), (10, 2, '6-12 meses'), (10, 3, '1-3 años'), (10, 4, 'Mas de 3 años'), (10, 5, 'No se espera crecimiento');

-- Opciones de las preguntas de escala (1 a 5 estrellas)
INSERT INTO opciones (pregunta_id, valor, etiqueta)
SELECT p.id, e.valor, e.etiqueta
FROM preguntas p
CROSS JOIN (VALUES (1, '1 estrella'), (2, '2 estrellas'), (3, '3 estrellas'),
                   (4, '4 estrellas'), (5, '5 estrellas')) AS e(valor, etiqueta)
WHERE p.tipo = 'escala';
```

> Los textos se copiaron tal cual del PDF, incluidas sus particularidades ("Mas de 1000", "No es un factor critico", "0-20" sin `%`, guiones `–` y `-` mezclados). Solo se quitó el punto suelto al inicio de la pregunta 4 ("4. . La información…"), que es un error de numeración.

> El insert de `respondientes` + `respuestas` debe ir en **una sola transacción** (si falla algo, no queda nada a medias).

## 6. Archivos de infraestructura

### `docker-compose.yml`
```yaml
services:
  web:
    build: ./web
    ports: ["80:80"]            # añadir "443:443" si se configura TLS
    volumes:
      - ./src/public:/var/www/html/public:ro
      - ./src/app:/var/www/html/app:ro
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    env_file: .env
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 5s
      timeout: 3s
      retries: 10
    restart: unless-stopped
    # SIN "ports": solo accesible por la red interna

volumes:
  pgdata:
```

### `.env.example`
```env
DB_HOST=db
DB_PORT=5432
DB_NAME=formulario
DB_USER=form_app
DB_PASSWORD=CAMBIAR_POR_UNA_CONTRASEÑA_LARGA
IP_SALT=CAMBIAR_POR_UNA_CADENA_ALEATORIA   # para ip_hash; generar con: openssl rand -hex 32
APP_ENV=production
```

### `web/Dockerfile`
```dockerfile
FROM php:8.3-apache

RUN apt-get update \
 && apt-get install -y --no-install-recommends libpq-dev \
 && docker-php-ext-install pdo_pgsql \
 && rm -rf /var/lib/apt/lists/*

RUN a2enmod headers \
 && mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

COPY custom.ini        $PHP_INI_DIR/conf.d/zz-custom.ini
COPY 000-default.conf  /etc/apache2/sites-available/000-default.conf
COPY security.conf     /etc/apache2/conf-available/security-extra.conf
RUN a2enconf security-extra

WORKDIR /var/www/html
```

### `web/000-default.conf`
```apache
<VirtualHost *:80>
    DocumentRoot /var/www/html/public
    DirectoryIndex index.html

    <Directory /var/www/html/public>
        Options -Indexes -FollowSymLinks
        AllowOverride None
        Require all granted

        # PHP bloqueado en todo el sitio...
        <FilesMatch "\.php$">
            Require all denied
        </FilesMatch>
    </Directory>

    # ...excepto dentro de /api
    <Directory /var/www/html/public/api>
        <FilesMatch "\.php$">
            Require all granted
        </FilesMatch>
    </Directory>

    # Tamaño máximo del cuerpo de la petición (16 KB) -> 413 si se excede
    LimitRequestBody 16384

    ErrorLog  /proc/self/fd/2
    CustomLog /proc/self/fd/1 combined
</VirtualHost>
```

### `web/security.conf`
```apache
ServerTokens Prod
ServerSignature Off
TraceEnable Off

Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "DENY"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set Content-Security-Policy "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; frame-ancestors 'none'"
```

### `web/custom.ini`
```ini
expose_php = Off
display_errors = Off
log_errors = On
session.cookie_httponly = 1
session.cookie_samesite = Strict
session.use_strict_mode = 1
```

> **Nota sobre el límite de frecuencia:** Apache no trae `limit_req` como Nginx. En lugar de agregar módulos de terceros (p. ej. `mod_evasive`), el límite se implementa en PHP consultando la BD (ver §7.2, paso 2). El índice `idx_respondientes_ip_fecha` lo hace barato.

---

## 7. Instrucciones por rol

### 7.1 Desarrollador Frontend (HTML / CSS / JS)

**Responsabilidades:** `index.html`, `gracias.html`, `styles.css`, `form.js`.

**Diseño (acorde a ESCOM / IPN)**
- Paleta institucional: guinda IPN (`#6A1B3A`, aproximado) y azul ESCOM (`#003A70`, aproximado); validar contra el manual de identidad gráfica del IPN. Fondo claro, texto con contraste ≥ 4.5:1.
- Encabezado con logos IPN y ESCOM, título de la materia y del proyecto. Pie con "Instituto Politécnico Nacional – Escuela Superior de Cómputo".
- Variables CSS en `:root` para colores, espaciados y radios.
- Mobile-first, con breakpoints en 600 px y 960 px. Probar de 320 px a 1440 px.
- Tipografía del sistema (`system-ui`) o fuente alojada localmente (la CSP bloquea CDNs externos).

**HTML**
- Título `<h1>`: **Evaluación de Modelo de Infraestructura TI**, seguido del aviso de privacidad del PDF (§1.1).
- Un solo `<form id="cuestionario" novalidate>` con un `<fieldset>` por pregunta; el `<legend>` lleva el número y el texto **exacto** de §5.2. No hay campos de datos personales.
- Cada pregunta es un grupo de 5 `<input type="radio" name="pN" value="1..5" required>`, cada uno con su `<label for>`. El `value` es la posición de la opción (opción única) o el número de estrellas (escala).
- Pregunta de opción única (ejemplo P1):
  ```html
  <fieldset id="q-p1" aria-describedby="err-p1">
    <legend>1. ¿Cuántos empleados tiene la empresa?</legend>
    <input type="radio" id="p1-1" name="p1" value="1" required><label for="p1-1">1-10</label>
    <input type="radio" id="p1-2" name="p1" value="2"><label for="p1-2">11-50</label>
    <!-- ... p1-3 "51-250", p1-4 "251-1000", p1-5 "Mas de 1000" -->
    <p class="error" id="err-p1" aria-live="polite"></p>
  </fieldset>
  ```
- Pregunta de escala (ejemplo P4): 5 radios dibujados como estrellas solo con CSS (`:checked` y `~`), sin imágenes externas. Mostrar la leyenda *"1 estrella: Totalmente en desacuerdo / 5 estrellas : Totalmente de acuerdo"*. Cada label debe tener texto accesible ("1 estrella" … "5 estrellas"), aunque visualmente sea un ícono.
  ```html
  <fieldset id="q-p4" class="escala" aria-describedby="ayuda-p4 err-p4">
    <legend>4. La información que maneja la empresa está sujeta a regulaciones estrictas (datos personales, financieros, de salud o gubernamentales)</legend>
    <p class="ayuda" id="ayuda-p4">1 estrella: Totalmente en desacuerdo<br>5 estrellas : Totalmente de acuerdo</p>
    <input type="radio" id="p4-1" name="p4" value="1" required><label for="p4-1"><span class="sr-only">1 estrella</span></label>
    <!-- ... p4-2 a p4-5 -->
    <p class="error" id="err-p4" aria-live="polite"></p>
  </fieldset>
  ```
- Incluir el campo honeypot oculto:
  ```html
  <div class="hp" aria-hidden="true"><input type="text" name="website" tabindex="-1" autocomplete="off"></div>
  ```
  (`.hp { position:absolute; left:-9999px; }` — no usar `display:none`).
- Mensajes de error con `aria-live="polite"` en cada pregunta; un resumen de errores arriba del botón "Enviar" que enlace a la primera pregunta sin responder.
- Opcional (UX): barra de progreso "N de 16 respondidas".

**JavaScript (`form.js`, sin frameworks, sin `eval`, sin scripts inline por la CSP)**
1. Al cargar: `GET /api/csrf.php` y guardar el token en memoria (no en `localStorage`).
2. Validación en cliente (misma lógica que el servidor, solo como UX): cada una de `p1`…`p16` debe tener una opción marcada. Armar el body como `{ respuestas: { p1: 2, ... }, website: "" }` con valores **numéricos** (`Number(...)`).
3. Al enviar: `preventDefault()`, deshabilitar el botón, `fetch('/api/submit.php', { method:'POST', headers:{'Content-Type':'application/json','X-CSRF-Token':token}, body: JSON.stringify(datos) })`.
4. Manejar respuestas: `201` → redirigir a `gracias.html`; `422` → pintar errores por campo; `403` → pedir nuevo token y reintentar una vez; `429` → mensaje "intenta en un minuto"; otros → mensaje genérico.
5. Mostrar los datos del usuario siempre con `textContent`, **nunca** `innerHTML`.
6. Evitar doble envío (botón deshabilitado mientras la petición está en curso).

**Definition of Done (Front):** funciona sin errores en consola, accesible por teclado, responsive, pasa Lighthouse (Accesibilidad ≥ 90), y respeta la CSP.

### 7.2 Desarrollador Backend (PHP)

**Responsabilidades:** `src/public/api/*.php`, `src/app/*.php`, esquema SQL.

**Reglas**
- `declare(strict_types=1);` en todos los archivos.
- Los archivos de `src/app/` **no** son accesibles por web (están fuera de `public/`). Los endpoints solo hacen `require` de ahí.
- Conexión con **PDO** (`pdo_pgsql`), `ERRMODE_EXCEPTION`, `EMULATE_PREPARES = false`. **Solo sentencias preparadas**, nunca concatenar SQL.
- Credenciales desde variables de entorno (`getenv`), nunca en el código.
- Los errores se registran (`error_log`) y al cliente se devuelve un mensaje genérico. `display_errors = Off`.

**`submit.php` — flujo obligatorio**
1. Rechazar si el método ≠ POST (`405`).
2. **Límite de frecuencia por IP:** calcular `ip_hash = hash('sha256', REMOTE_ADDR . getenv('IP_SALT'))` y contar en `respondientes` los registros con ese `ip_hash` en el último minuto; si son ≥ 5, responder `429`. (Apache no lo hace por sí solo; la IP nunca se guarda en claro.)
3. Leer `php://input`, limitar tamaño (≤ 16 KB) y `json_decode` estricto (`400` si falla).
4. Verificar token CSRF contra la sesión con `hash_equals` (`403`).
5. Si `website` (honeypot) no está vacío: responder `201` falso sin guardar.
6. Validar con `Validator`. Cargar al inicio el catálogo (`SELECT pregunta_id, valor FROM opciones JOIN preguntas ... WHERE activa`) y aplicar:
   - `respuestas` debe ser un objeto JSON; solo se aceptan claves con formato `^p([1-9]|1[0-6])$` que correspondan a una pregunta activa (las desconocidas se ignoran).
   - Cada valor debe ser **entero** (`is_int`, sin aceptar `"2"`, `2.5` ni `true`) y existir en `opciones` para esa pregunta (es decir, `1..5`).
   - Toda pregunta con `obligatoria = true` debe venir respondida; si falta → error `"Selecciona una opción"` en esa clave.
   - Cualquier otro campo del body (fuera de `respuestas` y `website`) se ignora.
7. Transacción: `INSERT INTO respondientes (ip_hash) VALUES (:h) RETURNING id` y luego un insert por respuesta en `respuestas` (16 filas). `COMMIT`; ante excepción, `ROLLBACK` y `500`. La llave foránea `(pregunta_id, valor) → opciones` es la segunda barrera si la validación fallara.
8. Si más adelante se pone un proxy delante, configurar `mod_remoteip` en Apache para que `REMOTE_ADDR` sea la IP real. No se guarda `user_agent` ni ningún dato identificable.
9. Responder `201` con `{ok:true,id}`.

**Seguridad PHP:** `session.cookie_httponly=1`, `session.cookie_samesite=Strict`, `session.use_strict_mode=1`, `expose_php=Off`.

**Base de datos:** crear el rol `form_app` con permisos de `INSERT` y `SELECT` en `respondientes`, `INSERT` en `respuestas` y `SELECT` en `preguntas` y `opciones` (más `USAGE` en la secuencia de `respondientes`). No usar el superusuario desde PHP.

**Definition of Done (Back):** todos los códigos de la tabla §4 se comportan como se describe; ninguna consulta usa concatenación; transacción verificada; sin warnings en el log.

### 7.3 QA

**Alcance:** validar funcionalidad, seguridad básica, responsividad y despliegue.

**Entorno:** primero local (`docker compose up -d --build`), luego en la VM de Azure con su IP pública.

#### Plan de pruebas

| ID | Área | Caso | Resultado esperado |
|---|---|---|---|
| F-01 | Funcional | Responder las 16 preguntas y enviar | `201`, redirección a `gracias.html`, 1 fila en `respondientes` y 16 en `respuestas` |
| F-02 | Funcional | Enviar dejando 1 o más preguntas sin responder | Error en cada pregunta faltante, nada se guarda |
| F-03 | Funcional | (curl) Valores inválidos: `"p1": 0`, `"p1": 6`, `"p1": "2"`, `"p1": 2.5`, `"p1": null` | `422` + error en `p1` |
| F-04 | Funcional | (curl) Valores límite `1` y `5` en todas; clave extra `p17`/`p0`/`nombre` | Se acepta; las claves extra se ignoran y no se guardan |
| F-05 | Funcional | Doble clic rápido en "Enviar" | Solo 1 registro |
| F-06 | Funcional | Comparar cada pregunta y opción en pantalla contra `Evaluación_TI.pdf` | Texto, orden y acentos idénticos (UTF-8 correcto) |
| F-07 | Funcional | Recargar `gracias.html` | No reenvía datos |
| F-08 | Funcional | Responder P1 con la 3ª opción y P4 con 5 estrellas; consultar BD | `respuestas` tiene `(1, 3)` y `(4, 5)`; la vista `resumen_respuestas` lo refleja |
| S-01 | Seguridad | (curl) `"p1": "1 OR 1=1"`, `"p1": "'; DROP TABLE respuestas;--"`, clave `"p1; DROP"` | `422` o clave ignorada; tablas intactas |
| S-02 | Seguridad | (curl) `<script>alert(1)</script>` como valor o en `website` | Rechazado; nunca se refleja en ninguna pantalla |
| S-03 | Seguridad | POST directo (curl) sin token CSRF | `403` |
| S-04 | Seguridad | GET a `/api/submit.php` | `405` |
| S-05 | Seguridad | Honeypot lleno | `201` falso y **sin** fila en BD |
| S-06 | Seguridad | 10 envíos en 1 minuto | `429` tras el límite |
| S-07 | Seguridad | Body de 1 MB | `413` (por `LimitRequestBody`) |
| S-08 | Seguridad | Pedir `/app/config.php`, `/.env`, `/db/init/01_schema.sql`; además, crear un `.php` de prueba fuera de `/api` y pedirlo | `404` los primeros; `403` el `.php` fuera de `/api` |
| S-11 | Seguridad | Pedir un directorio sin `index` (p. ej. `/assets/`) y revisar cabeceras de respuesta | Sin listado de archivos; `Server: Apache` sin versión ni `X-Powered-By` |
| S-09 | Seguridad | Provocar error (BD detenida) | Mensaje genérico, sin stack trace ni rutas |
| S-10 | Infra | Escaneo de puertos de la IP pública (`nmap`) | Solo 22 (restringido) y 80/443 abiertos; **5432 cerrado** |
| C-01 | Compatibilidad | Chrome, Firefox, Edge, Safari (o móvil real) | Mismo comportamiento |
| C-02 | Responsivo | 320, 375, 768, 1024, 1440 px | Sin scroll horizontal, botones usables |
| A-01 | Accesibilidad | Navegar solo con teclado y lector de pantalla | Orden lógico, etiquetas leídas, errores anunciados |
| A-02 | Accesibilidad | Lighthouse | Accesibilidad ≥ 90 |
| D-01 | Despliegue | `docker compose down && up -d` | Los datos persisten (volumen `pgdata`) |
| D-02 | Despliegue | Reiniciar la VM | Contenedores levantan solos (`restart: unless-stopped`) |
| D-03 | Despliegue | Acceso por IP pública desde otra red | Formulario carga y envía |

#### Comandos útiles
```bash
# Envío sin token (debe dar 403)
curl -i -X POST http://IP/api/submit.php -H 'Content-Type: application/json' -d '{"respuestas":{"p1":1}}'

# Revisar lo guardado
docker compose exec db psql -U form_app -d formulario -c "SELECT * FROM respondientes ORDER BY id DESC LIMIT 5;"
docker compose exec db psql -U form_app -d formulario -c "SELECT * FROM respuestas WHERE respondiente_id = (SELECT max(id) FROM respondientes) ORDER BY pregunta_id;"

# Verificar que el catálogo tiene 16 preguntas y 80 opciones
docker compose exec db psql -U form_app -d formulario -c "SELECT (SELECT count(*) FROM preguntas) AS preguntas, (SELECT count(*) FROM opciones) AS opciones;"

# Resultados agregados
docker compose exec db psql -U form_app -d formulario -c "SELECT * FROM resumen_respuestas;"

# Logs
docker compose logs -f web app
```

**Reporte de bugs:** ID, pasos, esperado vs. obtenido, captura, severidad (Crítica/Alta/Media/Baja). Se bloquea el release con cualquier Crítica o Alta abierta.

---

## 8. Despliegue en Azure

### 8.1 Crear la VM
1. Portal de Azure → **Máquinas virtuales → Crear**.
2. **Región:** *Mexico Central* (Querétaro). Verificar que esté disponible en tu suscripción de estudiante; si no, usar la región más cercana disponible y documentarlo.
3. **Imagen:** Ubuntu Server 24.04 LTS · **Tamaño:** `Standard_B2s` (2 vCPU / 4 GB) es suficiente.
4. **Autenticación:** llave SSH (no contraseña).
5. **Discos:** SSD estándar de 30 GB.
6. **Red (NSG):**

| Puerto | Origen | Uso |
|---|---|---|
| 22 | Tu IP pública solamente | SSH |
| 80 | Cualquiera | HTTP |
| 443 | Cualquiera | HTTPS (opcional) |
| 5432 | **Ninguno (no abrir)** | PostgreSQL |

7. Asignar **IP pública estática** (o usar el nombre DNS de Azure, ej. `tuformulario.<region>.cloudapp.azure.com`).

### 8.2 Preparar la VM
```bash
ssh azureuser@IP_PUBLICA

# Docker Engine + plugin compose
sudo apt-get update && sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
docker --version && docker compose version
```

### 8.3 Desplegar
```bash
git clone <URL_DEL_REPO> formulario-nube && cd formulario-nube
cp .env.example .env && nano .env          # poner contraseña real
docker compose up -d --build
docker compose ps                          # los 2 servicios deben estar "Up/healthy"
curl -I http://localhost                   # 200 OK
```
Abrir `http://IP_PUBLICA` desde el navegador.

### 8.4 Actualizar
```bash
git pull && docker compose up -d --build
```

### 8.5 Respaldo básico
```bash
docker compose exec -T db pg_dump -U form_app formulario > backup_$(date +%F).sql
```

### 8.6 HTTPS (opcional, recomendado)
Con un nombre DNS apuntando a la VM, usar Certbot (contenedor o en el host) con Let's Encrypt y habilitar `mod_ssl` (`a2enmod ssl`), publicar el 443 en `web`. Después, añadir redirección 80 → 443 y el header HSTS.

## 9. Checklist de entrega

- [ ] VM creada en Azure, región México (captura del portal con región y tamaño)
- [ ] `docker compose ps` con los 2 contenedores arriba (captura)
- [ ] Formulario cargando desde la IP pública (captura)
- [ ] Envío exitoso y página de agradecimiento (captura)
- [ ] Consulta `SELECT` mostrando los registros guardados (captura)
- [ ] Estructura de tablas (`\dt` y `\d respondientes`) (captura)
- [ ] Código fuente (HTML, CSS, JS, PHP, SQL, Docker) en el repositorio
- [ ] Reporte de QA con la tabla §7.3 completada
- [ ] Nota sobre uso de IA para el diseño del formulario, si el docente lo solicita

## 10. Decisiones de arquitectura (resumen)

| Decisión | Motivo |
|---|---|
| Apache 2.4 + `mod_php` (imagen `php:8.3-apache`) | Un solo contenedor para web y PHP, configuración simple y conocida |
| PostgreSQL con esquema normalizado | Cambiar el cuestionario = insertar filas, no migrar columnas |
| BD sin puerto publicado | Reduce la superficie de ataque; solo `app` la alcanza |
| CSRF + honeypot + límite de frecuencia en PHP | Protección básica contra abuso sin módulos extra de Apache |
| JS vanilla sin CDNs | CSP estricta y cero dependencias de terceros |
| Docker Compose | Entorno idéntico en local y en la VM; despliegue con un comando |
