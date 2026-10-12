<?php
declare(strict_types=1);

return [
    'db' => [
        'host' => getenv('DB_HOST') ?: 'db',
        'port' => (int)(getenv('DB_PORT') ?: 5432),
        'dbname' => getenv('DB_NAME') ?: 'formulario',
        'user' => getenv('DB_USER') ?: 'form_app',
        'password' => getenv('DB_PASSWORD') ?: '',
    ],
    'security' => [
        'ip_salt' => getenv('IP_SALT') ?: 'default_salt_change_me',
        'rate_limit_max' => 5,
        'rate_limit_window' => 60,
    ],
    'app_env' => getenv('APP_ENV') ?: 'production',
];
