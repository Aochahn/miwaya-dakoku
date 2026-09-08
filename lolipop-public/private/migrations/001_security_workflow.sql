ALTER TABLE users
  ADD COLUMN pin_hash VARCHAR(255) NULL AFTER active,
  ADD COLUMN last_login_at DATETIME NULL AFTER pin_hash;

UPDATE users
SET pin_hash = '$2y$10$oPh/UxlpyBHZxNzlzgMl1ex00U0RUHpnjYGoh6YTkuei7rYpNn.32'
WHERE pin_hash IS NULL;

CREATE TABLE admin_users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO admin_users (id, username, password_hash, active, created_at, updated_at) VALUES
('admin_default', 'admin', '$2y$10$XA3ginHGTlROUpJIrUEjDuVRZqYfEP8.G.HB72oII1t5NqCJlcOG2', 1, NOW(), NOW());

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
