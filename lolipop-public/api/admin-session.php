<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

$admin = current_admin();

json_response(200, [
    'authenticated' => $admin !== null,
    'admin' => $admin,
]);
