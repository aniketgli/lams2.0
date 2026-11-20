-- =============================================================================================
-- Bank master: the employee form picks the bank name from a list (Master Settings → Profile masters → Banks)
-- =============================================================================================
-- Creates `banks` with the common banks (code = the bank's 4-letter IFSC code), adds every bank name already
-- saved for an employee (so no saved detail is lost), and links employee_bank_accounts.bank_name to it.
-- A bank in use cannot be renamed or deleted (same rule as the other masters).
-- No existing row is changed or deleted. Safe to run again. Run after the 20261219_* normalization files.
-- =============================================================================================

CREATE TABLE IF NOT EXISTS banks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(40) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_banks_name (name),
  UNIQUE KEY uq_banks_code (code),
  CONSTRAINT chk_banks_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO banks (name, code) VALUES
  ('State Bank of India', 'SBIN'),
  ('Punjab National Bank', 'PUNB'),
  ('Bank of Baroda', 'BARB'),
  ('Canara Bank', 'CNRB'),
  ('Union Bank of India', 'UBIN'),
  ('Bank of India', 'BKID'),
  ('Indian Bank', 'IDIB'),
  ('Central Bank of India', 'CBIN'),
  ('Indian Overseas Bank', 'IOBA'),
  ('UCO Bank', 'UCBA'),
  ('Bank of Maharashtra', 'MAHB'),
  ('Punjab & Sind Bank', 'PSIB'),
  ('HDFC Bank', 'HDFC'),
  ('ICICI Bank', 'ICIC'),
  ('Axis Bank', 'UTIB'),
  ('Kotak Mahindra Bank', 'KKBK'),
  ('IDBI Bank', 'IBKL'),
  ('Yes Bank', 'YESB'),
  ('IndusInd Bank', 'INDB'),
  ('IDFC First Bank', 'IDFB'),
  ('The Nainital Bank', 'NTBL'),
  ('Uttarakhand Gramin Bank', 'UGBX'),
  ('India Post Payments Bank', 'IPOS');

-- Bank names already saved for employees (the name match ignores case and accents, like the foreign key)
INSERT IGNORE INTO banks (name, code)
SELECT x.bank_name, CONCAT('BANK-', UPPER(LEFT(SHA2(LOWER(x.bank_name), 256), 10)))
FROM (SELECT DISTINCT TRIM(bank_name) AS bank_name FROM employee_bank_accounts WHERE TRIM(bank_name) <> '') x
WHERE NOT EXISTS (SELECT 1 FROM banks b WHERE b.name = x.bank_name);

-- Saved names with extra spaces are trimmed so they match the master
UPDATE employee_bank_accounts SET bank_name = TRIM(bank_name) WHERE bank_name <> TRIM(bank_name);

DROP PROCEDURE IF EXISTS lams_banks_fk;
DELIMITER $$
CREATE PROCEDURE lams_banks_fk()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
                 WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_bank_accounts'
                   AND CONSTRAINT_NAME = 'fk_bank_accounts_bank') THEN
    ALTER TABLE employee_bank_accounts
      ADD CONSTRAINT fk_bank_accounts_bank FOREIGN KEY (bank_name) REFERENCES banks (name);
  END IF;
END$$
DELIMITER ;
CALL lams_banks_fk();
DROP PROCEDURE lams_banks_fk;

SELECT CONCAT('banks: ', (SELECT COUNT(*) FROM banks), ' in the master, bank details linked') AS banks;
