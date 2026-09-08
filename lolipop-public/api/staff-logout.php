<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

require_method('POST');

$userId = current_staff_user_id();
if ($userId !== '') {
    audit_log('staff', $userId, 'staff_logout', 'user', $userId);
}

unset($_SESSION['staff_user_id']);
session_regenerate_id(true);

json_response(200, ['ok' => true]);
