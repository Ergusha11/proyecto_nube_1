<?php
declare(strict_types=1);

class Validator
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * @param mixed $data
     * @return array{errors: array<string, string>, validResponses: array<int, int>}
     */
    public function validate(mixed $data): array
    {
        $errors = [];
        $validResponses = [];

        if (!is_array($data) || !isset($data['respuestas']) || !is_array($data['respuestas'])) {
            return [
                'errors' => ['respuestas' => 'El campo respuestas es obligatorio y debe ser un objeto'],
                'validResponses' => [],
            ];
        }

        $inputRespuestas = $data['respuestas'];

        // Cargar preguntas activas y sus opciones válidas
        $stmt = $this->pdo->query(
            "SELECT p.id, p.tipo, p.obligatoria, o.valor
             FROM preguntas p
             JOIN opciones o ON o.pregunta_id = p.id
             WHERE p.activa = TRUE
             ORDER BY p.id, o.valor"
        );
        $rows = $stmt->fetchAll();

        $preguntas = [];
        foreach ($rows as $row) {
            $pid = (int)$row['id'];
            if (!isset($preguntas[$pid])) {
                $preguntas[$pid] = [
                    'obligatoria' => (bool)$row['obligatoria'],
                    'opciones' => [],
                ];
            }
            $preguntas[$pid]['opciones'][] = (int)$row['valor'];
        }

        foreach ($preguntas as $id => $info) {
            $key = 'p' . $id;

            if (!array_key_exists($key, $inputRespuestas)) {
                if ($info['obligatoria']) {
                    $errors[$key] = 'Selecciona una opción';
                }
                continue;
            }

            $val = $inputRespuestas[$key];

            // Debe ser estrictamente entero (no string, no float, no boolean)
            if (!is_int($val)) {
                $errors[$key] = 'Valor inválido';
                continue;
            }

            if (!in_array($val, $info['opciones'], true)) {
                $errors[$key] = 'Valor fuera de rango';
                continue;
            }

            $validResponses[$id] = $val;
        }

        return [
            'errors' => $errors,
            'validResponses' => $validResponses,
        ];
    }
}
