<?php
declare(strict_types=1);

class Database
{
    private static ?PDO $instance = null;

    public static function getConnection(array $config): PDO
    {
        if (self::$instance === null) {
            $db = $config['db'];
            $dsn = sprintf(
                'pgsql:host=%s;port=%d;dbname=%s',
                $db['host'],
                $db['port'],
                $db['dbname']
            );

            self::$instance = new PDO(
                $dsn,
                $db['user'],
                $db['password'],
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]
            );
        }

        return self::$instance;
    }
}
