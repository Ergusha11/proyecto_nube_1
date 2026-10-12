<?php
declare(strict_types=1);

require_once __DIR__ . '/../../app/Response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::json(['ok' => false, 'error' => 'method'], 405);
}

$config = require __DIR__ . '/../../app/config.php';
require_once __DIR__ . '/../../app/Database.php';
require_once __DIR__ . '/../../app/Validator.php';

// Sesión para validación de CSRF
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_samesite', 'Strict');
ini_set('session.use_strict_mode', '1');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
$sessionToken = $_SESSION['csrf_token'] ?? '';

if ($csrfHeader === '' || $sessionToken === '' || !hash_equals($sessionToken, $csrfHeader)) {
    Response::json(['ok' => false, 'error' => 'csrf'], 403);
}

// Lectura del cuerpo
$rawInput = file_get_contents('php://input');
if ($rawInput === false || strlen($rawInput) > 16384) {
    Response::json(['ok' => false, 'error' => 'bad_request'], 400);
}

try {
    $data = json_decode($rawInput, true, 512, JSON_THROW_ON_ERROR);
} catch (JsonException) {
    Response::json(['ok' => false, 'error' => 'bad_request'], 400);
}

if (!is_array($data)) {
    Response::json(['ok' => false, 'error' => 'bad_request'], 400);
}

// Honeypot: si viene relleno, simular éxito sin persistir
if (!empty($data['website'])) {
    Response::json(['ok' => true, 'id' => 0], 201);
}

try {
    $pdo = Database::getConnection($config);
} catch (Throwable $e) {
    error_log("Database connection error: " . $e->getMessage());
    Response::json(['ok' => false, 'error' => 'server'], 500);
}

// Límite de frecuencia por IP
$ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
$ipHash = hash('sha256', $ip . $config['security']['ip_salt']);

try {
    $stmtRate = $pdo->prepare(
        "SELECT COUNT(*) FROM respondientes WHERE ip_hash = :hash AND creado_en >= NOW() - INTERVAL '1 minute'"
    );
    $stmtRate->execute([':hash' => $ipHash]);
    $count = (int)$stmtRate->fetchColumn();

    if ($count >= (int)$config['security']['rate_limit_max']) {
        Response::json(['ok' => false, 'error' => 'rate_limit'], 429);
    }
} catch (Throwable $e) {
    error_log("Rate limiting error: " . $e->getMessage());
    Response::json(['ok' => false, 'error' => 'server'], 500);
}

// Validación de respuestas
$validator = new Validator($pdo);
$valResult = $validator->validate($data);

if (!empty($valResult['errors'])) {
    Response::json(['ok' => false, 'errors' => $valResult['errors']], 422);
}

// Persistencia en una sola transacción
try {
    $pdo->beginTransaction();

    $stmtInsert = $pdo->prepare("INSERT INTO respondientes (ip_hash) VALUES (:ip_hash) RETURNING id");
    $stmtInsert->execute([':ip_hash' => $ipHash]);
    $respondienteId = (int)$stmtInsert->fetchColumn();

    $stmtResp = $pdo->prepare(
        "INSERT INTO respuestas (respondiente_id, pregunta_id, valor) VALUES (:resp_id, :preg_id, :valor)"
    );

    foreach ($valResult['validResponses'] as $preguntaId => $valor) {
        $stmtResp->execute([
            ':resp_id' => $respondienteId,
            ':preg_id' => $preguntaId,
            ':valor' => $valor,
        ]);
    }

    $pdo->commit();
    Response::json(['ok' => true, 'id' => $respondienteId], 201);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Transaction failed in submit.php: " . $e->getMessage());
    Response::json(['ok' => false, 'error' => 'server'], 500);
}
