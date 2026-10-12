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
