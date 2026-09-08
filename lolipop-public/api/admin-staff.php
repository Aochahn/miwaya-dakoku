<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

$admin = require_admin();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $stmt = db()->query(
        'SELECT id, name, display_order, active, last_login_at, archived_at, archive_note, created_at, updated_at
         FROM users
         WHERE active = 1
         ORDER BY display_order ASC, name ASC'
    );
    $archiveStmt = db()->query(
        'SELECT id, name, display_order, active, last_login_at, archived_at, archive_note, created_at, updated_at
         FROM users
         WHERE active = 0
         ORDER BY archived_at DESC, updated_at DESC, name ASC'
    );
    json_response(200, ['users' => $stmt->fetchAll(), 'archived_users' => $archiveStmt->fetchAll()]);
}

require_method('POST');

$payload = read_json_body();
$action = (string) ($payload['action'] ?? '');

if ($action === 'create_staff') {
    $name = trim((string) ($payload['name'] ?? ''));
    $displayOrder = (int) ($payload['display_order'] ?? 9999);
    $active = !empty($payload['active']) ? 1 : 0;
    $pin = (string) ($payload['pin'] ?? '');

    if ($name === '') {
        json_response(400, ['error' => 'スタッフ名を入力してください']);
    }
    if ($pin !== '' && !preg_match('/^\d{4,8}$/', $pin)) {
        json_response(400, ['error' => 'PINは4〜8桁の数字で入力してください']);
    }

    $now = date('Y-m-d H:i:s');
    $userId = 'user_' . bin2hex(random_bytes(12));
    $stmt = db()->prepare(
        'INSERT INTO users
          (id, name, display_order, active, pin_hash, created_at, updated_at)
         VALUES
          (:id, :name, :display_order, :active, :pin_hash, :created_at, :updated_at)'
    );
    $stmt->execute([
        ':id' => $userId,
        ':name' => $name,
        ':display_order' => $displayOrder,
        ':active' => $active,
        ':pin_hash' => $pin === '' ? null : password_hash($pin, PASSWORD_DEFAULT),
        ':created_at' => $now,
        ':updated_at' => $now,
    ]);

    audit_log('admin', $admin['id'], 'staff_create', 'user', $userId, null, [
        'id' => $userId,
        'name' => $name,
        'display_order' => $displayOrder,
        'active' => $active,
        'pin_set' => $pin !== '',
    ]);
    json_response(200, ['ok' => true, 'user_id' => $userId]);
}

if ($action === 'update_pin') {
    $userId = (string) ($payload['user_id'] ?? '');
    $pin = (string) ($payload['pin'] ?? '');
    if ($userId === '' || !preg_match('/^\d{4,8}$/', $pin)) {
        json_response(400, ['error' => 'PINは4〜8桁の数字で入力してください']);
    }

    $user = find_active_user($userId);
    if ($user === null) {
        json_response(404, ['error' => 'スタッフが見つかりません']);
    }

    $now = date('Y-m-d H:i:s');
    $stmt = db()->prepare('UPDATE users SET pin_hash = :pin_hash, updated_at = :updated_at WHERE id = :id');
    $stmt->execute([
        ':pin_hash' => password_hash($pin, PASSWORD_DEFAULT),
        ':updated_at' => $now,
        ':id' => $userId,
    ]);

    audit_log('admin', $admin['id'], 'staff_pin_update', 'user', $userId);
    json_response(200, ['ok' => true]);
}

if ($action === 'update_staff') {
    $userId = (string) ($payload['user_id'] ?? '');
    $name = trim((string) ($payload['name'] ?? ''));
    $displayOrder = (int) ($payload['display_order'] ?? 9999);
    if ($userId === '' || $name === '') {
        json_response(400, ['error' => 'スタッフ名を入力してください']);
    }

    $stmt = db()->prepare('SELECT id, name, display_order, active, archived_at, archive_note FROM users WHERE id = :id');
    $stmt->execute([':id' => $userId]);
    $before = $stmt->fetch();
    if (!is_array($before)) {
        json_response(404, ['error' => 'スタッフが見つかりません']);
    }

    $now = date('Y-m-d H:i:s');
    $update = db()->prepare(
        'UPDATE users
         SET name = :name, display_order = :display_order, updated_at = :updated_at
         WHERE id = :id'
    );
    $update->execute([
        ':name' => $name,
        ':display_order' => $displayOrder,
        ':updated_at' => $now,
        ':id' => $userId,
    ]);

    audit_log('admin', $admin['id'], 'staff_update', 'user', $userId, $before, [
        'id' => $userId,
        'name' => $name,
        'display_order' => $displayOrder,
    ]);
    json_response(200, ['ok' => true]);
}

if ($action === 'archive_staff') {
    $userId = (string) ($payload['user_id'] ?? '');
    $archiveNote = trim((string) ($payload['archive_note'] ?? ''));
    if ($userId === '') {
        json_response(400, ['error' => 'スタッフが指定されていません']);
    }

    $stmt = db()->prepare('SELECT id, name, display_order, active, archived_at, archive_note FROM users WHERE id = :id');
    $stmt->execute([':id' => $userId]);
    $before = $stmt->fetch();
    if (!is_array($before)) {
        json_response(404, ['error' => 'スタッフが見つかりません']);
    }

    $now = date('Y-m-d H:i:s');
    $update = db()->prepare(
        'UPDATE users
         SET active = 0, archived_at = :archived_at, archive_note = :archive_note, updated_at = :updated_at
         WHERE id = :id'
    );
    $update->execute([
        ':archived_at' => $now,
        ':archive_note' => $archiveNote === '' ? null : $archiveNote,
        ':updated_at' => $now,
        ':id' => $userId,
    ]);

    audit_log('admin', $admin['id'], 'staff_archive', 'user', $userId, $before, [
        'id' => $userId,
        'active' => 0,
        'archived_at' => $now,
        'archive_note' => $archiveNote,
    ]);
    json_response(200, ['ok' => true]);
}

if ($action === 'restore_staff') {
    $userId = (string) ($payload['user_id'] ?? '');
    if ($userId === '') {
        json_response(400, ['error' => 'スタッフが指定されていません']);
    }

    $stmt = db()->prepare('SELECT id, name, display_order, active, archived_at, archive_note FROM users WHERE id = :id');
    $stmt->execute([':id' => $userId]);
    $before = $stmt->fetch();
    if (!is_array($before)) {
        json_response(404, ['error' => 'スタッフが見つかりません']);
    }

    $now = date('Y-m-d H:i:s');
    $update = db()->prepare(
        'UPDATE users
         SET active = 1, archived_at = NULL, updated_at = :updated_at
         WHERE id = :id'
    );
    $update->execute([
        ':updated_at' => $now,
        ':id' => $userId,
    ]);

    audit_log('admin', $admin['id'], 'staff_restore', 'user', $userId, $before, [
        'id' => $userId,
        'active' => 1,
        'archived_at' => null,
    ]);
    json_response(200, ['ok' => true]);
}

if ($action === 'update_archive_note') {
    $userId = (string) ($payload['user_id'] ?? '');
    $archiveNote = trim((string) ($payload['archive_note'] ?? ''));
    if ($userId === '') {
        json_response(400, ['error' => 'スタッフが指定されていません']);
    }

    $stmt = db()->prepare('SELECT id, name, active, archive_note FROM users WHERE id = :id');
    $stmt->execute([':id' => $userId]);
    $before = $stmt->fetch();
    if (!is_array($before)) {
        json_response(404, ['error' => 'スタッフが見つかりません']);
    }

    $now = date('Y-m-d H:i:s');
    $update = db()->prepare('UPDATE users SET archive_note = :archive_note, updated_at = :updated_at WHERE id = :id');
    $update->execute([
        ':archive_note' => $archiveNote === '' ? null : $archiveNote,
        ':updated_at' => $now,
        ':id' => $userId,
    ]);

    audit_log('admin', $admin['id'], 'staff_archive_note_update', 'user', $userId, $before, [
        'id' => $userId,
        'archive_note' => $archiveNote,
    ]);
    json_response(200, ['ok' => true]);
}

json_response(400, ['error' => '未対応の操作です']);
