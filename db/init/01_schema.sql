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
