-- MySQL dump 10.13  Distrib 9.7.4, for Linux (x86_64)
--
-- Host: localhost    Database: lams2_db
-- ------------------------------------------------------
-- Server version	9.7.4

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
--


--
-- Table structure for table `Attendance`
--

DROP TABLE IF EXISTS `Attendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Attendance` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `EmployeeCode` varchar(50) NOT NULL,
  `LogDateTime` datetime(6) NOT NULL,
  `LogDate` date NOT NULL,
  `LogTime` time(6) DEFAULT NULL,
  `Direction` varchar(20) DEFAULT NULL,
  `DeviceName` varchar(150) DEFAULT NULL,
  `DeviceSR` varchar(120) DEFAULT NULL,
  `DeviceId` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_atten_date_emp` (`LogDate`,`EmployeeCode`),
  KEY `idx_atten_emp_date` (`EmployeeCode`,`LogDate`),
  KEY `idx_atten_cover` (`EmployeeCode`,`LogDate`,`LogDateTime`,`DeviceSR`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `account_settings`
--

DROP TABLE IF EXISTS `account_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `account_settings` (
  `id` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `default_password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` varchar(4) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `biometric_machines`
--

DROP TABLE IF EXISTS `biometric_machines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `biometric_machines` (
  `row_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `machine_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `short_name` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `serial_number` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `purpose` varchar(24) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ATTENDANCE',
  PRIMARY KEY (`row_id`),
  UNIQUE KEY `biometric_machines_short_name_unique` (`short_name`),
  UNIQUE KEY `biometric_machines_serial_number_unique` (`serial_number`),
  UNIQUE KEY `biometric_machines_ip_address_unique` (`ip_address`),
  UNIQUE KEY `uq_biometric_machines_machine_id` (`machine_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `categories_code_unique` (`code`),
  KEY `categories_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `designations`
--

DROP TABLE IF EXISTS `designations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `designations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `designations_code_unique` (`code`),
  KEY `designations_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `email_outbox`
--

DROP TABLE IF EXISTS `email_outbox`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_outbox` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `queued_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `event` varchar(60) NOT NULL,
  `reference_id` varchar(100) DEFAULT NULL,
  `category` varchar(20) NOT NULL DEFAULT 'NOTIFICATION',
  `to_email` varchar(254) NOT NULL,
  `to_name` varchar(255) DEFAULT NULL,
  `cc` text,
  `subject` varchar(500) NOT NULL,
  `body_html` mediumtext,
  `body_text` mediumtext,
  `with_logo` tinyint(1) NOT NULL DEFAULT '0',
  `status` varchar(12) NOT NULL DEFAULT 'pending',
  `attempts` tinyint unsigned NOT NULL DEFAULT '0',
  `next_attempt_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `locked_at` datetime(3) DEFAULT NULL,
  `sent_at` datetime(3) DEFAULT NULL,
  `cc_count` smallint unsigned NOT NULL DEFAULT '0',
  `bcc_count` smallint unsigned NOT NULL DEFAULT '0',
  `last_error` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_email_outbox_due` (`status`,`next_attempt_at`),
  KEY `idx_email_outbox_created` (`created_at`),
  CONSTRAINT `chk_email_outbox_status` CHECK ((`status` in (_cp850'pending',_cp850'sending',_cp850'sent',_cp850'failed',_cp850'not_sent')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `email_settings`
--

DROP TABLE IF EXISTS `email_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_settings` (
  `id` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `from_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_email` varchar(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `reply_to` varchar(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `smtp_host` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `smtp_port` int NOT NULL DEFAULT '587',
  `smtp_security` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'starttls',
  `smtp_user` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `smtp_password_enc` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `employee_mapping_log`
--

DROP TABLE IF EXISTS `employee_mapping_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_mapping_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `batch_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `kind` enum('transfer','manager_change') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `biometric_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `employee_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `prev_department` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_department` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prev_reporting_manager_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prev_reporting_manager_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_reporting_manager_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_reporting_manager_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prev_hod_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prev_hod_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_hod_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_hod_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `effective_date` date NOT NULL,
  `notes` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `done_by_biometric_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `done_by_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mapping_user` (`user_id`),
  KEY `idx_mapping_batch` (`batch_id`),
  KEY `idx_mapping_effective` (`effective_date`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `employee_photos`
--

DROP TABLE IF EXISTS `employee_photos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_photos` (
  `biometric_id` varchar(4) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `byte_size` int unsigned NOT NULL,
  `data` mediumblob,
  `storage_path` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` varchar(4) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`biometric_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `employee_profiles`
--

DROP TABLE IF EXISTS `employee_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_profiles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `biometric_id` char(4) NOT NULL,
  `suffix` varchar(10) DEFAULT NULL,
  `department` varchar(255) NOT NULL,
  `designation` varchar(255) NOT NULL,
  `employment_type` varchar(50) NOT NULL,
  `joining_date` varchar(10) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `office_location` varchar(255) DEFAULT NULL,
  `institute` varchar(50) DEFAULT NULL,
  `shift_id` varchar(36) DEFAULT NULL,
  `profile_data` text,
  `reporting_manager_id` bigint unsigned GENERATED ALWAYS AS ((case when json_valid(`profile_data`) then (case when regexp_like(json_unquote(json_extract(`profile_data`,_utf8mb4'$.reportingManagerId')),_utf8mb4'^[0-9]{1,18}$') then cast(json_unquote(json_extract(`profile_data`,_utf8mb4'$.reportingManagerId')) as unsigned) end) end)) STORED,
  `reviewing_manager_id` bigint unsigned GENERATED ALWAYS AS ((case when json_valid(`profile_data`) then (case when regexp_like(json_unquote(json_extract(`profile_data`,_utf8mb4'$.reviewingManagerId')),_utf8mb4'^[0-9]{1,18}$') then cast(json_unquote(json_extract(`profile_data`,_utf8mb4'$.reviewingManagerId')) as unsigned) end) end)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_profiles_biometric_id_unique` (`biometric_id`),
  KEY `idx_profiles_reporting_manager` (`reporting_manager_id`),
  KEY `idx_profiles_reviewing_manager` (`reviewing_manager_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `holidays`
--

DROP TABLE IF EXISTS `holidays`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `holidays` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `holiday_date` date NOT NULL,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `hindi_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` varchar(4) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` varchar(4) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_holiday_date_name` (`holiday_date`,`name`),
  KEY `idx_holiday_date` (`holiday_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leave_balances`
--

DROP TABLE IF EXISTS `leave_balances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_balances` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `leave_type_id` bigint unsigned NOT NULL,
  `cycle_year` smallint unsigned NOT NULL,
  `cycle_type` varchar(2) NOT NULL DEFAULT 'CY',
  `total` decimal(6,1) NOT NULL,
  `carry_forward` decimal(6,1) NOT NULL DEFAULT '0.0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `as_of` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_leave_balance` (`user_id`,`leave_type_id`,`cycle_year`),
  KEY `idx_leave_balance_type` (`leave_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leave_certificates`
--

DROP TABLE IF EXISTS `leave_certificates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_certificates` (
  `request_id` bigint unsigned NOT NULL,
  `file_name` varchar(200) NOT NULL,
  `mime_type` varchar(40) NOT NULL,
  `size_bytes` int unsigned NOT NULL,
  `data` mediumblob,
  `storage_path` varchar(200) DEFAULT NULL,
  `uploaded_by` bigint unsigned NOT NULL,
  `uploaded_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leave_comp_off_uses`
--

DROP TABLE IF EXISTS `leave_comp_off_uses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_comp_off_uses` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `request_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `work_date` date NOT NULL,
  `leave_date` date NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_comp_off_request_work` (`request_id`,`work_date`),
  KEY `idx_comp_off_user_work` (`user_id`,`work_date`),
  KEY `idx_comp_off_user_leave` (`user_id`,`leave_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leave_group_types`
--

DROP TABLE IF EXISTS `leave_group_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_group_types` (
  `group_id` bigint unsigned NOT NULL,
  `leave_type_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`group_id`,`leave_type_id`),
  KEY `fk_leave_group_types_type` (`leave_type_id`),
  CONSTRAINT `fk_leave_group_types_group` FOREIGN KEY (`group_id`) REFERENCES `leave_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_leave_group_types_type` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leave_groups`
--

DROP TABLE IF EXISTS `leave_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_groups` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `name` varchar(100) NOT NULL,
  `leave_year` varchar(2) NOT NULL,
  `status` varchar(10) NOT NULL DEFAULT 'active',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_leave_groups_code` (`code`),
  UNIQUE KEY `uq_leave_groups_name` (`name`),
  CONSTRAINT `chk_leave_groups_status` CHECK ((`status` in (_cp850'active',_cp850'inactive')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leave_joining_certificates`
--

DROP TABLE IF EXISTS `leave_joining_certificates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_joining_certificates` (
  `report_id` bigint unsigned NOT NULL,
  `file_name` varchar(200) NOT NULL,
  `mime_type` varchar(40) NOT NULL,
  `size_bytes` int unsigned NOT NULL,
  `data` mediumblob,
  `storage_path` varchar(200) DEFAULT NULL,
  `uploaded_by` bigint unsigned NOT NULL,
  `uploaded_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`report_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leave_joining_reports`
--

DROP TABLE IF EXISTS `leave_joining_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_joining_reports` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `request_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `joining_date` date NOT NULL,
  `punch_in` time DEFAULT NULL,
  `punch_out` time DEFAULT NULL,
  `status` varchar(12) NOT NULL DEFAULT 'pending_l1',
  `manager_id` bigint unsigned DEFAULT NULL,
  `reviewer_id` bigint unsigned DEFAULT NULL,
  `submitted_by` bigint unsigned NOT NULL,
  `submitted_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `l1_by` bigint unsigned DEFAULT NULL,
  `l1_at` datetime(3) DEFAULT NULL,
  `l1_comment` varchar(500) DEFAULT NULL,
  `decided_stage` tinyint unsigned DEFAULT NULL,
  `action_by` bigint unsigned DEFAULT NULL,
  `action_at` datetime(3) DEFAULT NULL,
  `manager_comment` varchar(500) DEFAULT NULL,
  `undo_count` tinyint unsigned NOT NULL DEFAULT '0',
  `undo2_count` tinyint unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_leave_joining_request` (`request_id`),
  KEY `idx_leave_joining_user` (`user_id`),
  KEY `idx_leave_joining_status` (`status`),
  CONSTRAINT `chk_leave_joining_status` CHECK ((`status` in (_cp850'pending_l1',_cp850'pending_l2',_cp850'approved',_cp850'rejected')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leave_requests`
--

DROP TABLE IF EXISTS `leave_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_requests` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `leave_type_id` bigint unsigned NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `start_session` varchar(12) NOT NULL DEFAULT 'full',
  `end_session` varchar(12) NOT NULL DEFAULT 'full',
  `days_count` decimal(5,1) NOT NULL,
  `cycle_year` smallint unsigned NOT NULL,
  `reason` varchar(1000) NOT NULL,
  `certificate` tinyint(1) NOT NULL DEFAULT '0',
  `station_leave` tinyint(1) NOT NULL DEFAULT '0',
  `stages` tinyint unsigned NOT NULL DEFAULT '1',
  `status` varchar(16) NOT NULL DEFAULT 'pending_l1',
  `applied_by` bigint unsigned NOT NULL,
  `manager_id` bigint unsigned DEFAULT NULL,
  `reviewer_id` bigint unsigned DEFAULT NULL,
  `l1_by` bigint unsigned DEFAULT NULL,
  `l1_at` datetime(3) DEFAULT NULL,
  `l1_comment` varchar(500) DEFAULT NULL,
  `decided_stage` tinyint unsigned DEFAULT NULL,
  `action_by` bigint unsigned DEFAULT NULL,
  `action_at` datetime(3) DEFAULT NULL,
  `manager_comment` varchar(500) DEFAULT NULL,
  `undo_count` tinyint unsigned NOT NULL DEFAULT '0',
  `undo2_count` tinyint unsigned NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `ltc_type` varchar(10) NOT NULL DEFAULT 'none',
  `encash_days` tinyint unsigned NOT NULL DEFAULT '0',
  `contact_address` varchar(300) DEFAULT NULL,
  `prefix_from` date DEFAULT NULL,
  `prefix_to` date DEFAULT NULL,
  `suffix_from` date DEFAULT NULL,
  `suffix_to` date DEFAULT NULL,
  `linked_to` bigint unsigned DEFAULT NULL,
  `comp_off_date` date DEFAULT NULL,
  `purpose` varchar(150) DEFAULT NULL,
  `child_event` varchar(10) DEFAULT NULL,
  `child_event_date` date DEFAULT NULL,
  `child_birth_date` date DEFAULT NULL,
  `surviving_children` tinyint unsigned DEFAULT NULL,
  `child_order` tinyint unsigned DEFAULT NULL,
  `child_disabled` tinyint(1) NOT NULL DEFAULT '0',
  `single_parent` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_leave_user_start` (`user_id`,`start_date`),
  KEY `idx_leave_dates` (`start_date`,`end_date`),
  KEY `idx_leave_type` (`leave_type_id`),
  KEY `idx_leave_status` (`status`),
  KEY `idx_leave_requests_linked_to` (`linked_to`),
  KEY `idx_leave_comp_off` (`user_id`,`comp_off_date`),
  CONSTRAINT `chk_leave_requests_status` CHECK ((`status` in (_cp850'pending_l1',_cp850'pending_l2',_cp850'approved',_cp850'rejected')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leave_type_quotas`
--

DROP TABLE IF EXISTS `leave_type_quotas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_type_quotas` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `leave_type_id` bigint unsigned NOT NULL,
  `employee_type` varchar(50) NOT NULL,
  `quota` decimal(6,1) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_leave_type_quotas` (`leave_type_id`,`employee_type`),
  CONSTRAINT `fk_leave_type_quotas_type` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leave_types`
--

DROP TABLE IF EXISTS `leave_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_types` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `default_quota` decimal(6,1) NOT NULL DEFAULT '0.0',
  `pwd_quota` decimal(6,1) DEFAULT NULL,
  `accrual` varchar(16) NOT NULL DEFAULT 'yearly',
  `max_accumulation` smallint unsigned NOT NULL DEFAULT '0',
  `carry_forward` tinyint(1) NOT NULL DEFAULT '0',
  `max_carry_forward` decimal(6,1) NOT NULL DEFAULT '0.0',
  `encashment_allowed` tinyint(1) NOT NULL DEFAULT '0',
  `approval_stages` tinyint unsigned NOT NULL DEFAULT '1',
  `min_notice_days` smallint unsigned NOT NULL DEFAULT '0',
  `half_day_allowed` tinyint(1) NOT NULL DEFAULT '0',
  `medical_cert_days` smallint unsigned NOT NULL DEFAULT '0',
  `sandwich_rule` varchar(8) NOT NULL DEFAULT 'excluded',
  `combine_with` varchar(8) NOT NULL DEFAULT 'both',
  `employee_types` varchar(500) NOT NULL DEFAULT '',
  `pwd_only` tinyint(1) NOT NULL DEFAULT '0',
  `gender` varchar(12) NOT NULL DEFAULT 'all',
  `min_service_months` smallint unsigned NOT NULL DEFAULT '0',
  `max_consecutive_days` smallint unsigned NOT NULL DEFAULT '0',
  `is_debited` tinyint(1) NOT NULL DEFAULT '1',
  `is_paid` tinyint(1) NOT NULL DEFAULT '1',
  `joining_required` tinyint(1) NOT NULL DEFAULT '0',
  `after_exhausted_type_id` bigint unsigned DEFAULT NULL,
  `debit_from_type_id` bigint unsigned DEFAULT NULL,
  `debit_factor` decimal(3,1) NOT NULL DEFAULT '1.0',
  `lifetime_max` decimal(7,1) NOT NULL DEFAULT '0.0',
  `max_spells_per_year` smallint unsigned NOT NULL DEFAULT '0',
  `min_days_per_application` decimal(5,1) NOT NULL DEFAULT '0.0',
  `max_spells_per_month` smallint unsigned NOT NULL DEFAULT '0',
  `max_spells_lifetime` smallint unsigned NOT NULL DEFAULT '0',
  `status` varchar(10) NOT NULL DEFAULT 'active',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `needs_contact` tinyint(1) NOT NULL DEFAULT '0',
  `ltc_allowed` tinyint(1) NOT NULL DEFAULT '0',
  `prefix_suffix` tinyint(1) NOT NULL DEFAULT '0',
  `hod_after_days` decimal(5,1) NOT NULL DEFAULT '0.0',
  `certificate_required` tinyint(1) NOT NULL DEFAULT '0',
  `off_days_only` tinyint(1) NOT NULL DEFAULT '0',
  `fitness_certificate` tinyint(1) NOT NULL DEFAULT '0',
  `purposes` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_leave_types_code` (`code`),
  UNIQUE KEY `uq_leave_types_name` (`name`),
  CONSTRAINT `chk_leave_types_status` CHECK ((`status` in (_cp850'active',_cp850'inactive')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lookup_values`
--

DROP TABLE IF EXISTS `lookup_values`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lookup_values` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lookup_type` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lookup_type_code` (`lookup_type`,`code`),
  KEY `idx_lookup_type` (`lookup_type`,`status`,`sort_order`),
  CONSTRAINT `chk_lookup_values_status` CHECK ((`status` in (_cp850'ACTIVE',_cp850'INACTIVE')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `manual_attendance_requests`
--

DROP TABLE IF EXISTS `manual_attendance_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `manual_attendance_requests` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `att_date` date NOT NULL,
  `in_time` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `out_time` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_in` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `original_out` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `applied_by` bigint unsigned NOT NULL,
  `manager_id` bigint unsigned DEFAULT NULL,
  `action_by` bigint unsigned DEFAULT NULL,
  `action_at` datetime(3) DEFAULT NULL,
  `manager_comment` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `undo_count` tinyint unsigned NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_manual_user_date` (`user_id`,`att_date`),
  KEY `idx_manual_date` (`att_date`),
  KEY `idx_manual_status` (`status`),
  CONSTRAINT `chk_manual_attendance_status` CHECK ((`status` in (_cp850'pending',_cp850'approved',_cp850'rejected')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `master_audit_logs`
--

DROP TABLE IF EXISTS `master_audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `master_audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `master_key` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_label` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `changed_fields` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `before_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `after_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `reason` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actor_biometric_id` varchar(4) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actor_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actor_role` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `legacy_ref` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_master_audit_legacy` (`legacy_ref`),
  KEY `idx_master_audit_master` (`master_key`,`created_at`),
  KEY `idx_master_audit_record` (`master_key`,`record_id`),
  KEY `idx_master_audit_created` (`created_at`),
  KEY `idx_master_audit_actor` (`actor_biometric_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `msc_batches`
--

DROP TABLE IF EXISTS `msc_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `msc_batches` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `msc_batches_code_unique` (`code`),
  KEY `msc_batches_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `msc_streams`
--

DROP TABLE IF EXISTS `msc_streams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `msc_streams` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `msc_streams_code_unique` (`code`),
  KEY `msc_streams_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notification_recipients`
--

DROP TABLE IF EXISTS `notification_recipients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_recipients` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `recipient_type` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `scope` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ALL',
  `email` varchar(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_notification_recipient_email_scope` (`email`,`scope`),
  CONSTRAINT `chk_notification_recipients_status` CHECK ((`status` in (_cp850'ACTIVE',_cp850'INACTIVE')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `organization_settings`
--

DROP TABLE IF EXISTS `organization_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `organization_settings` (
  `id` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `org_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `logo_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `address` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `copyright_text` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `organization_units`
--

DROP TABLE IF EXISTS `organization_units`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `organization_units` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Department',
  `institute` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `organization_units_code_unique` (`code`),
  UNIQUE KEY `id_new` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `outdoor_duty_requests`
--

DROP TABLE IF EXISTS `outdoor_duty_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `outdoor_duty_requests` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `start_time` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `end_time` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `days_count` smallint unsigned NOT NULL,
  `od_type` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `location` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `estimated_funds` decimal(12,2) NOT NULL DEFAULT '0.00',
  `funding_source` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `purpose` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `applied_by` bigint unsigned NOT NULL,
  `manager_id` bigint unsigned DEFAULT NULL,
  `action_by` bigint unsigned DEFAULT NULL,
  `action_at` datetime(3) DEFAULT NULL,
  `manager_comment` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `undo_count` tinyint unsigned NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_od_user` (`user_id`,`start_date`),
  KEY `idx_od_dates` (`start_date`,`end_date`),
  KEY `idx_od_status` (`status`),
  CONSTRAINT `chk_outdoor_duty_status` CHECK ((`status` in (_cp850'pending',_cp850'approved',_cp850'rejected')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `phd_enrollments`
--

DROP TABLE IF EXISTS `phd_enrollments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `phd_enrollments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `phd_enrollments_code_unique` (`code`),
  KEY `phd_enrollments_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `projects_code_unique` (`code`),
  KEY `projects_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `report_runs`
--

DROP TABLE IF EXISTS `report_runs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report_runs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `schedule_id` bigint unsigned NOT NULL,
  `ran_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `trigger_type` varchar(10) NOT NULL,
  `period_from` date DEFAULT NULL,
  `period_to` date DEFAULT NULL,
  `status` varchar(16) NOT NULL,
  `sent_count` int unsigned NOT NULL DEFAULT '0',
  `message` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_report_runs_schedule` (`schedule_id`,`ran_at`),
  CONSTRAINT `chk_report_runs_status` CHECK ((`status` in (_cp850'sent',_cp850'partial',_cp850'failed',_cp850'no_recipients')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `report_schedule_recipients`
--

DROP TABLE IF EXISTS `report_schedule_recipients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report_schedule_recipients` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `schedule_id` bigint unsigned NOT NULL,
  `kind` varchar(6) NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `role_id` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_report_recipients_schedule` (`schedule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `report_schedules`
--

DROP TABLE IF EXISTS `report_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report_schedules` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `report_key` varchar(40) NOT NULL,
  `frequency` varchar(10) NOT NULL,
  `weekday` tinyint unsigned DEFAULT NULL,
  `month_day` tinyint unsigned DEFAULT NULL,
  `send_time` char(5) NOT NULL,
  `formats` varchar(10) NOT NULL DEFAULT 'pdf',
  `status` varchar(10) NOT NULL DEFAULT 'active',
  `last_slot` varchar(10) DEFAULT NULL,
  `last_run_at` datetime(3) DEFAULT NULL,
  `last_status` varchar(16) DEFAULT NULL,
  `last_message` varchar(500) DEFAULT NULL,
  `created_by` varchar(20) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_report_schedules_status` (`status`),
  CONSTRAINT `chk_report_schedules_last` CHECK (((`last_status` in (_cp850'sent',_cp850'partial',_cp850'failed',_cp850'no_recipients')) or (`last_status` is null))),
  CONSTRAINT `chk_report_schedules_status` CHECK ((`status` in (_utf8mb4'active',_utf8mb4'paused')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `role_catalog`
--

DROP TABLE IF EXISTS `role_catalog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_catalog` (
  `module_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `access_role` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `aliases` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`module_id`,`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `shifts`
--

DROP TABLE IF EXISTS `shifts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shifts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `start_time` varchar(10) NOT NULL,
  `end_time` varchar(10) NOT NULL,
  `grace_period_mins` int DEFAULT '0',
  `half_day_hours` decimal(3,1) DEFAULT NULL,
  `full_day_hours` decimal(3,1) DEFAULT NULL,
  `is_default` tinyint(1) DEFAULT '0',
  `status` varchar(16) NOT NULL DEFAULT 'active',
  `half_day_cutoff_time` time DEFAULT NULL,
  `description` text,
  `applicable_days` json DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `trainee_batches`
--

DROP TABLE IF EXISTS `trainee_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trainee_batches` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `trainee_batches_code_unique` (`code`),
  KEY `trainee_batches_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `training_courses`
--

DROP TABLE IF EXISTS `training_courses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `training_courses` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `training_courses_code_unique` (`code`),
  KEY `training_courses_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_account_audit_logs`
--

DROP TABLE IF EXISTS `user_account_audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_account_audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `target_biometric_id` char(4) NOT NULL,
  `target_name` varchar(255) NOT NULL,
  `target_email` varchar(255) NOT NULL,
  `action` varchar(32) NOT NULL,
  `reason` text,
  `reference` varchar(255) DEFAULT NULL,
  `deleted_by` char(4) NOT NULL,
  `deleted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_account_audit_target_biometric` (`target_biometric_id`),
  KEY `idx_user_account_audit_deleted_at` (`deleted_at`),
  KEY `idx_user_account_audit_deleted_by` (`deleted_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_histories`
--

DROP TABLE IF EXISTS `user_histories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_histories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `biometric_id` varchar(4) NOT NULL,
  `project_name` varchar(255) NOT NULL,
  `project_code` varchar(100) DEFAULT NULL,
  `pi_name` varchar(255) DEFAULT NULL,
  `pi_email` varchar(255) DEFAULT NULL,
  `role_in_project` varchar(255) DEFAULT NULL,
  `pay` varchar(255) DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `is_ongoing` tinyint(1) NOT NULL DEFAULT '0',
  `department` varchar(255) DEFAULT NULL,
  `funding_agency` varchar(255) DEFAULT NULL,
  `grant_amount` varchar(255) DEFAULT NULL,
  `responsibilities` longtext,
  `remarks` longtext,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_project_histories_biometric_id` (`biometric_id`),
  KEY `idx_user_project_histories_start_date` (`start_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_module_roles`
--

DROP TABLE IF EXISTS `user_module_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_module_roles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `biometric_id` char(4) NOT NULL,
  `module_id` varchar(80) NOT NULL,
  `role_id` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_updated_by` char(4) DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_module_role_biometric_unique` (`biometric_id`,`module_id`,`role_id`),
  KEY `user_module_roles_user_module_idx` (`module_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `biometric_id` char(4) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT (now()),
  `status` enum('active','inactive','expired') NOT NULL DEFAULT 'active',
  `valid_upto` date DEFAULT NULL,
  `last_updated_by` varchar(20) DEFAULT NULL,
  `last_updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `last_update_summary` text,
  `must_change_password` tinyint(1) NOT NULL DEFAULT '0',
  `password_changed_at` datetime DEFAULT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  UNIQUE KEY `new_id` (`id`),
  UNIQUE KEY `users_biometric_id_unique` (`biometric_id`),
  CONSTRAINT `chk_users_status` CHECK ((`status` in (_utf8mb4'active',_utf8mb4'inactive',_utf8mb4'expired')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `web_sessions`
--

DROP TABLE IF EXISTS `web_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `web_sessions` (
  `sid` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `expires_at` datetime(3) NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`sid`),
  KEY `idx_web_sessions_expires` (`expires_at`),
  KEY `idx_web_sessions_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `zz_retired___drizzle_migrations`
--

DROP TABLE IF EXISTS `zz_retired___drizzle_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `zz_retired___drizzle_migrations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `hash` text NOT NULL,
  `created_at` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `zz_retired_biometric_machine_audit_logs`
--

DROP TABLE IF EXISTS `zz_retired_biometric_machine_audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `zz_retired_biometric_machine_audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `machine_id` varchar(64) NOT NULL,
  `action` enum('CREATE','UPDATE','DELETE') NOT NULL,
  `changed_by_biometric_id` varchar(4) DEFAULT NULL,
  `changed_by_name` varchar(255) DEFAULT NULL,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reason` text,
  `before_data` longtext,
  `after_data` longtext,
  PRIMARY KEY (`id`),
  KEY `idx_biometric_machine_audit_machine` (`machine_id`),
  KEY `idx_biometric_machine_audit_changed_at` (`changed_at`),
  KEY `idx_biometric_machine_audit_actor` (`changed_by_biometric_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `zz_retired_organization_unit_audit_logs`
--

DROP TABLE IF EXISTS `zz_retired_organization_unit_audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `zz_retired_organization_unit_audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned NOT NULL,
  `organization_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `organization_code` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` enum('CREATE','UPDATE','DELETE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `changed_by_biometric_id` varchar(4) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changed_by_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `before_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `after_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `idx_org_unit_audit_org_id` (`organization_id`),
  KEY `idx_org_unit_audit_changed_at` (`changed_at`),
  KEY `idx_org_unit_audit_actor` (`changed_by_biometric_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `zz_retired_sessions`
--

DROP TABLE IF EXISTS `zz_retired_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `zz_retired_sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `expires` timestamp NOT NULL,
  `data` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `zz_retired_shift_master_audit_logs`
--

DROP TABLE IF EXISTS `zz_retired_shift_master_audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `zz_retired_shift_master_audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `shift_id` bigint unsigned NOT NULL,
  `shift_code` varchar(50) NOT NULL,
  `action` varchar(24) NOT NULL,
  `changed_by_biometric_id` varchar(4) DEFAULT NULL,
  `changed_by_name` varchar(255) DEFAULT NULL,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reason` text,
  `before_data` longtext,
  `after_data` longtext,
  PRIMARY KEY (`id`),
  KEY `idx_shift_audit_shift_id` (`shift_id`),
  KEY `idx_shift_audit_changed_at` (`changed_at`),
  KEY `idx_shift_audit_actor` (`changed_by_biometric_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `zz_retired_user_logs`
--

DROP TABLE IF EXISTS `zz_retired_user_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `zz_retired_user_logs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `biometric_id` char(4) NOT NULL,
  `action` enum('CREATE','DEACTIVATE','REACTIVATE','AUTO_EXPIRE','VALIDITY_UPDATED') NOT NULL,
  `reason` varchar(255) NOT NULL,
  `reference` varchar(255) DEFAULT NULL,
  `previous_status` enum('active','inactive','expired') DEFAULT NULL,
  `new_status` enum('active','inactive','expired') DEFAULT NULL,
  `previous_valid_upto` date DEFAULT NULL,
  `new_valid_upto` date DEFAULT NULL,
  `effective_date` date DEFAULT NULL,
  `updated_by` varchar(20) NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_logs_biometric_id` (`biometric_id`),
  KEY `idx_user_logs_action` (`action`),
  KEY `idx_user_logs_updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-19 17:03:48
