# Formulario en la Nube — Evaluación de Modelo de Infraestructura TI

[![Docker](https://img.shields.io/badge/Docker-Compose_v2-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![PHP](https://img.shields.io/badge/PHP-8.3_mod__php-777BB4?logo=php&logoColor=white)](https://www.php.net/)
[![Apache](https://img.shields.io/badge/Apache-2.4-D22128?logo=apache&logoColor=white)](https://httpd.apache.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16_Alpine-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Azure](https://img.shields.io/badge/Azure-VM_Ubuntu_24.04-0078D4?logo=microsoftazure&logoColor=white)](https://azure.microsoft.com/)
[![IPN-ESCOM](https://img.shields.io/badge/ESCOM-IPN-682444)](https://www.escom.ipn.mx/)

Proyecto académico para la asignatura de **Cómputo en la Nube** (Unidad II: *Configuración e implantación de una nube*), Parcial 01 en la **Escuela Superior de Cómputo (ESCOM)** del **Instituto Politécnico Nacional (IPN)**.

La aplicación consiste en un formulario web contenerizado de alto rendimiento y seguridad que implementa el cuestionario institucional de **Evaluación de Modelo de Infraestructura TI** (Actividad sumativa 04, extraído de `Evaluación_TI.pdf`). Todo el stack se ejecuta en contenedores Docker orquestados con Docker Compose y diseñado para su despliegue en una Máquina Virtual de Microsoft Azure.

---

## 📋 Tabla de Contenidos

- [Resumen y Cuestionario](#-resumen-y-cuestionario)
- [Arquitectura del Sistema](#-arquitectura-del-sistema)
- [Seguridad y Endurecimiento](#-seguridad-y-endurecimiento)
- [Estructura del Repositorio](#-estructura-del-repositorio)
- [Requisitos Previos](#-requisitos-previos)
- [Despliegue Local (Paso a Paso)](#-despliegue-local-paso-a-paso)
- [Despliegue en Azure](#-despliegue-en-azure)
- [Consultas y Verificación en PostgreSQL](#-consultas-y-verificación-en-postgresql)
- [Matriz de Pruebas de QA](#-matriz-de-pruebas-de-qa)
- [Licencia y Créditos](#-licencia-y-créditos)

---

## 📝 Resumen y Cuestionario

El sistema reproduce **exactamente** las 16 preguntas técnicas del cuestionario de evaluación de infraestructura:

1. **Garantía de Privacidad y Anonimato**: La encuesta **no solicita ni recopila datos personales** (sin nombre, sin correo, sin boleta), en estricto cumplimiento con la leyenda original:
   > *"Cuando envíe este formulario, no recopilará automáticamente sus detalles, como el nombre y la dirección de correo electrónico, a menos que lo proporcione usted mismo."*
2. **Tipos de Pregunta**:
   - **Opción Única (7 preguntas)**: Preguntas 1, 2, 3, 6, 7, 8 y 10 (con 5 opciones cada una).
   - **Escala de Calificación (9 preguntas)**: Preguntas 4, 5, 9, 11, 12, 13, 14, 15 y 16 (escala de 1 a 5 estrellas con leyenda accesible: *1 estrella: Totalmente en desacuerdo · 5 estrellas : Totalmente de acuerdo*).
3. **Persistencia Normalizada**: Cada respuesta se almacena como un valor entero `1..5`, validado contra un catálogo en PostgreSQL con integridad referencial estricta.

---

## 🏛 Arquitectura del Sistema

Alineada con el modelo multicapa (*Vista → Servicios → Procesamiento → Almacenamiento*):

```
 Capa Vista            Servicios (Nube)           Procesamiento              Almacenamiento
┌────────────┐      ┌──────────────────────┐   ┌─────────────────────┐    ┌──────────────┐
│ Navegador  │ 80/  │ Azure VM (Ubuntu)    │   │ Apache 2.4 + PHP    │    │ PostgreSQL   │
│ (PC/Móvil) ├─443─►│ + NSG (Firewall)     ├──►│ HTML5 / CSS3 / JS   ├───►│ (Volumen     │
│ HTML+CSS+JS│      │ + IP Pública / VNet  │   │ /api/*.php (PDO)    │    │  Persistente)│
└────────────┘      └──────────────────────┘   └─────────────────────┘    └──────────────┘
                                                  Red Docker Interna ─────────────┘
```

### Servicios Docker Compose

| Servicio | Imagen | Puerto Host | Descripción |
|---|---|---|---|
| `web` | `php:8.3-apache` (+ `pdo_pgsql`) | `80:80` (y `443:443`) | Sirve estáticos y ejecuta la API PHP con `mod_php`. |
| `db` | `postgres:16-alpine` | **No expuesto** | Base de datos relacional. Solo accesible dentro de la red interna de Docker. |

---

## 🛡 Seguridad y Endurecimiento

El stack fue auditado e implementa múltiples capas de defensa en profundidad:

- **Aislamiento de la Base de Datos**: PostgreSQL no publica puertos al host (`ports` omitido). Solo el contenedor `web` tiene acceso mediante la red interna de Docker.
- **Restricción de Ejecución PHP**: Apache bloquea la ejecución de cualquier archivo `.php` en todo el sitio web (`Require all denied`), permitiendo su ejecución **únicamente** dentro del subdirectorio `/api`.
- **Protección contra CSRF**: Endpoints protegidos mediante token criptográfico único (`bin2hex(random_bytes(32))`), verificado con `hash_equals()` y respaldado por sesiones PHP con cookies `HttpOnly` y `SameSite=Strict`.
- **Límite de Frecuencia por IP (Rate Limiting)**: Previene ataques de denegación de servicio o spam limitando a un máximo de 5 envíos por minuto por cliente. La IP nunca se almacena en texto plano; se guarda únicamente un hash `SHA-256(IP + IP_SALT)`.
- **Honeypot Anti-Spam**: Campo trampa invisible (`website`) para bots. Si un robot lo llena, el servidor devuelve un `201 Created` ficticio sin alterar la base de datos.
- **Content Security Policy (CSP) Estricta**:
  ```text
  default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; frame-ancestors 'none'
  ```
  Sin dependencias de CDNs externos, sin scripts en línea (`unsafe-inline` prohibido), sin `eval`.
- **Ocultamiento de Versiones**: `ServerTokens Prod`, `ServerSignature Off` y `expose_php = Off` (no expone versiones de Apache, Debian ni PHP).
- **Límite de Carga Útil**: `LimitRequestBody 16384` (16 KB máx.), rechazando payloads maliciosos con código `413 Request Entity Too Large`.
- **Transaccionalidad ACID**: La inserción del respondiente y sus 16 respuestas se ejecuta en una sola transacción (`BEGIN` / `COMMIT`). Si ocurre cualquier fallo, se aplica `ROLLBACK`.

---

## 📂 Estructura del Repositorio

```text
.
├── docker-compose.yml              # Configuración de servicios Docker
├── .env.example                    # Plantilla de variables de entorno
├── .gitignore                      # Exclusión de .env, volúmenes y temporales
├── ARQUITECTURA.md                 # Documento maestro de arquitectura y diseño
├── Evaluación_TI.pdf               # Instrumento original de evaluación
├── README.md                       # Documentación principal del proyecto
├── web/
│   ├── Dockerfile                  # Construcción de la imagen Apache + PHP 8.3 + PDO
│   ├── 000-default.conf            # VirtualHost y directivas de seguridad de Apache
│   ├── security.conf               # Cabeceras HTTP de seguridad (CSP, HSTS, X-Frame)
│   └── custom.ini                  # Endurecimiento de la configuración de PHP
├── db/
│   └── init/
│       ├── 01_schema.sql           # Esquema relacional, tablas, índices y vistas
│       └── 02_preguntas.sql        # Poblado inicial con las 16 preguntas y 80 opciones
└── src/
    ├── app/                        # Lógica PHP privada (no accesible vía HTTP)
    │   ├── config.php              # Parámetros y variables de entorno
    │   ├── Database.php            # Conexión Singleton PDO segura
    │   ├── Validator.php           # Validación exhaustiva contra catálogo activo
    │   └── Response.php            # Formateador de respuestas HTTP y JSON
    └── public/                     # DocumentRoot público servido por Apache
        ├── index.html              # Formulario con diseño ESCOM/IPN y 16 preguntas
        ├── gracias.html            # Pantalla de confirmación con folio de envío
        ├── assets/
        │   ├── css/styles.css      # Sistema de diseño, estrellas CSS y mobile-first
        │   ├── js/form.js          # Consumo de API, validación y control de barra
        │   ├── js/gracias.js       # Visualización de folio y marca temporal
        │   └── img/
        │       ├── ipn-logo.svg    # Logotipo vectorial institucional del IPN
        │       └── escom-logo.svg  # Logotipo vectorial institucional de la ESCOM
        └── api/
            ├── csrf.php            # GET: Emisión segura de token CSRF
            └── submit.php          # POST: Recepción, validación y persistencia
```

---

## ⚙️ Requisitos Previos

- **Docker Engine** (v24.0 o superior)
- **Docker Compose** (plugin v2.20 o superior)
- **Git**

Verificar instalación en terminal:
```bash
docker --version && docker compose version
```

---

## 🚀 Despliegue Local (Paso a Paso)

### 1. Clonar el repositorio
```bash
git clone <URL_DEL_REPOSITORIO> formulario-nube
cd formulario-nube
```

### 2. Configurar variables de entorno
Copia la plantilla `.env.example` a un archivo `.env`:
```bash
cp .env.example .env
```

Genera valores aleatorios seguros para la contraseña de la BD y la sal de IP:
```bash
# Generar contraseña y salt aleatorios:
openssl rand -hex 16
openssl rand -hex 32
```
Edita `.env` con tus valores generados:
```env
DB_HOST=db
DB_PORT=5432
DB_NAME=formulario
DB_USER=form_app
DB_PASSWORD=tu_contraseña_generada
IP_SALT=tu_salt_aleatorio_generado
APP_ENV=production
```

### 3. Levantar los contenedores
```bash
docker compose up -d --build
```

### 4. Verificar el estado
```bash
docker compose ps
```
Ambos contenedores deben mostrar estado `Up` (y `proyectoi-db-1` en estado `healthy`).

### 5. Abrir en el navegador
Ingresa a: **[http://localhost](http://localhost)**

---

## ☁️ Despliegue en Azure

Para desplegar en una Máquina Virtual de Azure siguiendo la arquitectura:

1. **Crear Máquina Virtual en Azure Portal**:
   - **Región**: *Mexico Central* (Querétaro) o la más cercana con suscripción disponible.
   - **Imagen**: Ubuntu Server 24.04 LTS.
   - **Tamaño**: `Standard_B2s` (2 vCPU, 4 GB RAM).
   - **Autenticación**: Llave SSH pública.
   - **Grupo de Seguridad de Red (NSG)**:
     - Puerto `22`: SSH (restringido a tu IP pública).
     - Puerto `80`: HTTP (permitido a cualquiera `*`).
     - Puerto `443`: HTTPS (opcional, si se añade SSL).
     - Puerto `5432`: **Denegado / cerrado al exterior**.
2. **Conectar vía SSH**:
   ```bash
   ssh -i ~/.ssh/tu_llave.pem azureuser@IP_PUBLICA_AZURE
   ```
3. **Instalar Docker Engine en la VM**:
   ```bash
   sudo apt-get update && sudo apt-get install -y ca-certificates curl git
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER && newgrp docker
   ```
4. **Clonar y Levantar el Proyecto**:
   ```bash
   git clone <URL_DEL_REPOSITORIO> formulario-nube
   cd formulario-nube
   cp .env.example .env && nano .env
   docker compose up -d --build
   ```
5. **Acceso Web**: Accede a `http://IP_PUBLICA_AZURE`.

---

## 🔍 Consultas y Verificación en PostgreSQL

Puedes interactuar con la base de datos contenerizada en cualquier momento:

### Ver los últimos registros de respondientes:
```bash
docker compose exec db psql -U form_app -d formulario -c "SELECT * FROM respondientes ORDER BY id DESC LIMIT 5;"
```

### Ver las 16 respuestas de un respondiente específico (ej. ID 1):
```bash
docker compose exec db psql -U form_app -d formulario -c "SELECT * FROM respuestas WHERE respondiente_id = 1 ORDER BY pregunta_id;"
```

### Ver el reporte estadístico y resumen de respuestas agrupadas:
```bash
docker compose exec db psql -U form_app -d formulario -c "SELECT * FROM resumen_respuestas WHERE total > 0;"
```

### Generar un respaldo SQL de la base de datos:
```bash
docker compose exec -T db pg_dump -U form_app formulario > backup_$(date +%F).sql
```

---

## 🧪 Matriz de Pruebas de QA

| ID | Categoría | Caso de Prueba | Resultado Esperado | Estado |
|---|---|---|---|:---:|
| **F-01** | Funcional | Envío de las 16 respuestas válidas | Respuesta `201`, redirección a `gracias.html`, persistencia en BD | ✅ Aprobado |
| **F-02** | Funcional | Envío incompleto (falta responder) | Respuesta `422`, resumen de errores y marcado visual | ✅ Aprobado |
| **F-03** | Funcional | Tipos de datos inválidos (strings, flotantes) | Respuesta `422` con mensaje `"Valor inválido"` | ✅ Aprobado |
| **F-04** | Funcional | Valores límite (1 y 5) y campos desconocidos | Valores aceptados; campos extras descartados | ✅ Aprobado |
| **F-05** | Funcional | Prevención de doble clic en botón de envío | Botón deshabilitado durante la petición, 1 solo registro | ✅ Aprobado |
| **F-06** | Funcional | Cotejo exacto contra `Evaluación_TI.pdf` | Enunciados, orden y opciones idénticos | ✅ Aprobado |
| **S-01** | Seguridad | Intentos de inyección SQL (`' OR 1=1 --`) | Rechazado por validador o escapado por PDO | ✅ Aprobado |
| **S-02** | Seguridad | Intentos de inyección XSS (`<script>`) | Sanitizado y bloqueado; no se ejecuta | ✅ Aprobado |
| **S-03** | Seguridad | POST directo sin token CSRF | Respuesta `403 Forbidden` (`error: "csrf"`) | ✅ Aprobado |
| **S-04** | Seguridad | Petición GET a `/api/submit.php` | Respuesta `405 Method Not Allowed` | ✅ Aprobado |
| **S-05** | Seguridad | Activación del honeypot (`website` lleno) | Respuesta `201` simulada sin persistencia en BD | ✅ Aprobado |
| **S-06** | Seguridad | Envío masivo (> 5 peticiones/minuto) | Respuesta `429 Too Many Requests` | ✅ Aprobado |
| **S-07** | Seguridad | Carga útil mayor a 16 KB | Respuesta `413 Request Entity Too Large` | ✅ Aprobado |
| **S-08** | Seguridad | Acceso a archivos `.php` fuera de `/api` | Respuesta `403 Forbidden` | ✅ Aprobado |
| **S-11** | Seguridad | Fuga de versiones en cabecera HTTP | `Server: Apache` sin versión ni divulgación de SO | ✅ Aprobado |
| **D-01** | Despliegue | Reinicio de Docker (`down` y `up`) | Persistencia de datos en volumen `pgdata` | ✅ Aprobado |

---

## 👥 Licencia y Créditos

- **Institución**: [Instituto Politécnico Nacional](https://www.ipn.mx/)
- **Unidad Académica**: [Escuela Superior de Cómputo (ESCOM)](https://www.escom.ipn.mx/)
- **Asignatura**: Cómputo en la Nube
- **Desarrollado para**: Proyecto Parcial 01 — Formulario en la Nube
