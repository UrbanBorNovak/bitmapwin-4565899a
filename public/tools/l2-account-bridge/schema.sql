-- Run once in the LOCAL L2 login database. Do not expose MySQL to the internet.
CREATE TABLE IF NOT EXISTS bitmapwin_l2_wallets (
  login VARCHAR(14) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  bitcoin_address VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  passport_user_id CHAR(36) CHARACTER SET ascii NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS bitmapwin_l2_challenges (
  nonce CHAR(36) CHARACTER SET ascii PRIMARY KEY,
  passport_user_id CHAR(36) CHARACTER SET ascii NOT NULL,
  login VARCHAR(14) CHARACTER SET ascii NOT NULL,
  bitcoin_address VARCHAR(90) CHARACTER SET ascii NOT NULL,
  password_commitment CHAR(64) CHARACTER SET ascii NOT NULL,
  expires_at BIGINT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX challenge_user (passport_user_id, created_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS bitmapwin_l2_limits (
  passport_user_id CHAR(36) CHARACTER SET ascii PRIMARY KEY,
  touched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
-- Create a dedicated localhost DB user through your local admin tool.
-- Give it ONLY SELECT/INSERT on accounts and bitmapwin_l2_wallets,
-- SELECT/INSERT/UPDATE/DELETE on bitmapwin_l2_challenges,
-- SELECT/INSERT/UPDATE on bitmapwin_l2_limits. No global/admin privileges.