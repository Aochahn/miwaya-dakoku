<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

require_method('POST');

$admin = current_admin();
if ($admin !== null) {
    audit_log('admin', $admin['id'], 'admin_logout', 'admin_user', $admin['id']);
}

unset($_SESSION['admin_id']);
session_regenerate_id(true);

json_response(200, ['ok' => true]);
