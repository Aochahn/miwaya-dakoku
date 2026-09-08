CREATE TABLE users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  display_order INT NOT NULL DEFAULT 9999,
  active TINYINT(1) NOT NULL DEFAULT 1,
  pin_hash VARCHAR(255) NULL,
  last_login_at DATETIME NULL,
  archived_at DATETIME NULL,
  archive_note TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE attendance_records (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  type ENUM('clock_in', 'clock_out') NOT NULL,
  recorded_at DATETIME NOT NULL,
  photo_url VARCHAR(512) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_attendance_user_recorded_at (user_id, recorded_at),
  INDEX idx_attendance_recorded_at (recorded_at),
  CONSTRAINT fk_attendance_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE admin_users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE correction_requests (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  requested_type ENUM('clock_in', 'clock_out') NOT NULL,
  requested_at DATETIME NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  admin_note TEXT NULL,
  reviewed_by VARCHAR(64) NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_correction_status_created (status, created_at),
  INDEX idx_correction_user_created (user_id, created_at),
  CONSTRAINT fk_correction_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_correction_admin
    FOREIGN KEY (reviewed_by) REFERENCES admin_users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  actor_type ENUM('admin', 'staff', 'system') NOT NULL,
  actor_id VARCHAR(64) NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(100) NULL,
  target_id VARCHAR(64) NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_actor (actor_type, actor_id),
  INDEX idx_audit_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE member_shifts (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  shift_date DATE NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  break_minutes INT NOT NULL DEFAULT 0,
  note TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uniq_member_shift_user_date (user_id, shift_date),
  INDEX idx_member_shifts_date (shift_date),
  CONSTRAINT fk_member_shifts_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE shift_preferences (
  user_id VARCHAR(64) PRIMARY KEY,
  role ENUM('hall', 'kitchen') NOT NULL DEFAULT 'hall',
  available_days VARCHAR(32) NOT NULL DEFAULT '',
  available_start TIME NOT NULL DEFAULT '17:30:00',
  available_end TIME NOT NULL DEFAULT '24:00:00',
  priority TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_shift_preferences_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO users (id, name, display_order, active, pin_hash, created_at, updated_at) VALUES
('user_yamada', '山田 太郎', 1, 1, '$2y$10$oPh/UxlpyBHZxNzlzgMl1ex00U0RUHpnjYGoh6YTkuei7rYpNn.32', NOW(), NOW()),
('user_tanaka', '田中 花子', 2, 1, '$2y$10$oPh/UxlpyBHZxNzlzgMl1ex00U0RUHpnjYGoh6YTkuei7rYpNn.32', NOW(), NOW()),
('user_sato', '佐藤 一郎', 3, 1, '$2y$10$oPh/UxlpyBHZxNzlzgMl1ex00U0RUHpnjYGoh6YTkuei7rYpNn.32', NOW(), NOW());

INSERT INTO admin_users (id, username, password_hash, active, created_at, updated_at) VALUES
('admin_default', 'admin', '$2y$10$XA3ginHGTlROUpJIrUEjDuVRZqYfEP8.G.HB72oII1t5NqCJlcOG2', 1, NOW(), NOW());
