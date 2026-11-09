CREATE DATABASE IF NOT EXISTS `db-sppd`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `db-sppd`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `officer_tokens`;
DROP TABLE IF EXISTS `officers`;
DROP TABLE IF EXISTS `report_photos`;
DROP TABLE IF EXISTS `report_logs`;
DROP TABLE IF EXISTS `reports`;
DROP TABLE IF EXISTS `rooms`;
DROP TABLE IF EXISTS `app_sequences`;
DROP TABLE IF EXISTS `admin`;
DROP TABLE IF EXISTS `laporan`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE DATABASE IF NOT EXISTS `db-sppd`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `db-sppd`;

CREATE TABLE IF NOT EXISTS `rooms` (
  `id` VARCHAR(120) PRIMARY KEY,
  `code` VARCHAR(40) NULL,
  `name` VARCHAR(180) NOT NULL,
  `building` VARCHAR(120) NULL,
  `floor` VARCHAR(40) NULL,
  `category` VARCHAR(80) NULL,
  `leader` VARCHAR(180) NULL,
  `phone` VARCHAR(80) NULL,
  `note` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_rooms_category` (`category`),
  INDEX `idx_rooms_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reports` (
  `ticket_no` VARCHAR(32) PRIMARY KEY,
  `area` VARCHAR(220) NOT NULL,
  `room_category` VARCHAR(80) NULL,
  `category` VARCHAR(120) NOT NULL,
  `reporter` VARCHAR(160) NOT NULL,
  `contact` VARCHAR(80) NOT NULL,
  `detail` TEXT NOT NULL,
  `status` ENUM('open','investigating','in_progress','user_issue','resolved') NOT NULL DEFAULT 'open',
  `assigned_to` VARCHAR(80) NULL,
  `assigned_name` VARCHAR(160) NULL,
  `assigned_at` DATETIME NULL,
  `due_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  INDEX `idx_reports_status` (`status`),
  INDEX `idx_reports_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `report_logs` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `ticket_no` VARCHAR(32) NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `note` TEXT NULL,
  `created_at` DATETIME NOT NULL,
  CONSTRAINT `fk_report_logs_ticket`
    FOREIGN KEY (`ticket_no`) REFERENCES `reports` (`ticket_no`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `report_photos` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `ticket_no` VARCHAR(32) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `uploaded_by` VARCHAR(160) NULL,
  `created_at` DATETIME NOT NULL,
  CONSTRAINT `fk_report_photos_ticket`
    FOREIGN KEY (`ticket_no`) REFERENCES `reports` (`ticket_no`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `officers` (
  `id` VARCHAR(80) PRIMARY KEY,
  `username` VARCHAR(80) NOT NULL UNIQUE,
  `name` VARCHAR(160) NOT NULL,
  `phone` VARCHAR(80) NULL,
  `salt` VARCHAR(80) NOT NULL,
  `hash` VARCHAR(160) NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `officer_tokens` (
  `token` VARCHAR(120) PRIMARY KEY,
  `officer_id` VARCHAR(80) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_officer_tokens_officer`
    FOREIGN KEY (`officer_id`) REFERENCES `officers` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `app_sequences` (
  `name` VARCHAR(80) PRIMARY KEY,
  `value` INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('ast-01-asisten-pemerintahan-dan-kesejahteraan-rakyat', 'AST-01', 'Asisten Pemerintahan dan Kesejahteraan Rakyat', 'Asisten', NULL, 'Asisten', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('ast-02-asisten-ekonomi-dan-pembangunan', 'AST-02', 'Asisten Ekonomi dan Pembangunan', 'Asisten', NULL, 'Asisten', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('ast-03-asisten-administrasi-umum', 'AST-03', 'Asisten Administrasi Umum', 'Asisten', NULL, 'Asisten', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('sah-01-staf-ahli-bidang-pemerintahan', 'SAH-01', 'Staf Ahli Bidang Pemerintahan', 'Staf Ahli', NULL, 'Staf Ahli', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('sah-02-staf-ahli-bidang-ekonomi-dan-pembangunan', 'SAH-02', 'Staf Ahli Bidang Ekonomi dan Pembangunan', 'Staf Ahli', NULL, 'Staf Ahli', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('sah-03-staf-ahli-bidang-kesra-dan-sosial', 'SAH-03', 'Staf Ahli Bidang Kesra dan Sosial', 'Staf Ahli', NULL, 'Staf Ahli', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-01-sekretariat-dprd', 'DIN-01', 'Sekretariat DPRD', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-02-inspektorat', 'DIN-02', 'Inspektorat', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-03-dinas-koperasi-dan-usaha-kecil-menengah', 'DIN-03', 'Dinas Koperasi dan Usaha Kecil Menengah', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-04-dinas-perumahan-kawasan-permukiman-dan-pertanahan', 'DIN-04', 'Dinas Perumahan, Kawasan Permukiman dan Pertanahan', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-05-dinas-pekerjaan-umum-dan-penataan-ruang', 'DIN-05', 'Dinas Pekerjaan Umum dan Penataan Ruang', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-06-dinas-perdagangan-dan-perindustrian', 'DIN-06', 'Dinas Perdagangan dan Perindustrian', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-07-dinas-tanaman-pangan-dan-holtikultura', 'DIN-07', 'Dinas Tanaman Pangan dan Holtikultura', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-08-dinas-perpustakaan-dan-kearsipan', 'DIN-08', 'Dinas Perpustakaan dan Kearsipan', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-09-dinas-kependudukan-dan-pencatatan-sipil', 'DIN-09', 'Dinas Kependudukan dan Pencatatan Sipil', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-10-dinas-tenaga-kerja-dan-transmigrasi', 'DIN-10', 'Dinas Tenaga Kerja dan Transmigrasi', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-11-dinas-perkebunan-dan-peternakan', 'DIN-11', 'Dinas Perkebunan dan Peternakan', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-12-dinas-perikanan-dan-kelautan', 'DIN-12', 'Dinas Perikanan dan Kelautan', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-13-dinas-pariwisata-dan-kebudayaan', 'DIN-13', 'Dinas Pariwisata dan Kebudayaan', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-14-dinas-perhubungan', 'DIN-14', 'Dinas Perhubungan', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-15-dinas-kesehatan', 'DIN-15', 'Dinas Kesehatan', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-16-dinas-pemberdayaan-perempuan-dan-perlindungan-anak', 'DIN-16', 'Dinas Pemberdayaan Perempuan dan Perlindungan Anak', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-17-dinas-pemberdayaan-masyarakat-dan-desa', 'DIN-17', 'Dinas Pemberdayaan Masyarakat dan Desa', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-18-dinas-komunikasi-informatika-statistik-dan-persandian', 'DIN-18', 'Dinas Komunikasi, Informatika, Statistik dan Persandian', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-19-dinas-pemuda-dan-olahraga', 'DIN-19', 'Dinas Pemuda dan Olahraga', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-20-dinas-sosial', 'DIN-20', 'Dinas Sosial', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-21-dinas-pendidikan', 'DIN-21', 'Dinas Pendidikan', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-22-dinas-pengendalian-penduduk-dan-keluarga-berencana', 'DIN-22', 'Dinas Pengendalian Penduduk dan Keluarga Berencana', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-23-dinas-ketahanan-pangan', 'DIN-23', 'Dinas Ketahanan Pangan', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-24-dinas-lingkungan-hidup', 'DIN-24', 'Dinas Lingkungan Hidup', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-25-dinas-pemadam-kebakaran-dan-penyelamatan', 'DIN-25', 'Dinas Pemadam Kebakaran dan Penyelamatan', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('din-26-dinas-penanaman-modal-dan-pelayanan-terpadu-satu-pintu', 'DIN-26', 'Dinas Penanaman Modal dan Pelayanan Terpadu Satu Pintu', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bad-01-badan-pendapatan-daerah', 'BAD-01', 'Badan Pendapatan Daerah', 'Badan', NULL, 'Badan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bad-02-badan-pengelolaan-keuangan-daerah', 'BAD-02', 'Badan Pengelolaan Keuangan Daerah', 'Badan', NULL, 'Badan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bad-03-badan-perencanaan-dan-pembangunan-daerah', 'BAD-03', 'Badan Perencanaan dan Pembangunan Daerah', 'Badan', NULL, 'Badan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bad-04-badan-penelitian-dan-pengembangan-daerah', 'BAD-04', 'Badan Penelitian dan Pengembangan Daerah', 'Badan', NULL, 'Badan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bad-05-badan-penanggulangan-bencana-daerah', 'BAD-05', 'Badan Penanggulangan Bencana Daerah', 'Badan', NULL, 'Badan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bad-06-badan-kepegawaian-dan-pengembangan-sdm', 'BAD-06', 'Badan Kepegawaian dan Pengembangan SDM', 'Badan', NULL, 'Badan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bad-07-badan-kesatuan-bangsa-dan-politik', 'BAD-07', 'Badan Kesatuan Bangsa dan Politik', 'Badan', NULL, 'Badan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bad-08-satuan-polisi-pamong-praja', 'BAD-08', 'Satuan Polisi Pamong Praja', 'Badan', NULL, 'Badan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bad-09-rsud-syekh-yusuf', 'BAD-09', 'RSUD Syekh Yusuf', 'Badan', NULL, 'Badan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bag-01-bagian-tata-pemerintahan', 'BAG-01', 'Bagian Tata Pemerintahan', 'Bagian', NULL, 'Bagian', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bag-02-bagian-hukum', 'BAG-02', 'Bagian Hukum', 'Bagian', NULL, 'Bagian', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bag-03-bagian-protokol-dan-komunikasi-pimpinan', 'BAG-03', 'Bagian Protokol dan Komunikasi Pimpinan', 'Bagian', NULL, 'Bagian', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bag-04-bagian-kesejahteraan-rakyat', 'BAG-04', 'Bagian Kesejahteraan Rakyat', 'Bagian', NULL, 'Bagian', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bag-05-bagian-pengadaan-barang-jasa', 'BAG-05', 'Bagian Pengadaan Barang/Jasa', 'Bagian', NULL, 'Bagian', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bag-06-bagian-kerjasama', 'BAG-06', 'Bagian Kerjasama', 'Bagian', NULL, 'Bagian', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bag-07-bagian-umum', 'BAG-07', 'Bagian Umum', 'Bagian', NULL, 'Bagian', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bag-08-bagian-perencanaan-dan-keuangan', 'BAG-08', 'Bagian Perencanaan dan Keuangan', 'Bagian', NULL, 'Bagian', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bag-09-bagian-perekonomian-dan-administrasi-pembangunan', 'BAG-09', 'Bagian Perekonomian dan Administrasi Pembangunan', 'Bagian', NULL, 'Bagian', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bag-10-bagian-organisasi', 'BAG-10', 'Bagian Organisasi', 'Bagian', NULL, 'Bagian', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kec-01-kecamatan-somba-opu', 'KEC-01', 'Kecamatan Somba Opu', 'Kecamatan', NULL, 'Kecamatan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kec-02-kecamatan-pallangga', 'KEC-02', 'Kecamatan Pallangga', 'Kecamatan', NULL, 'Kecamatan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kec-03-kecamatan-barombong', 'KEC-03', 'Kecamatan Barombong', 'Kecamatan', NULL, 'Kecamatan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kec-04-kecamatan-bajeng', 'KEC-04', 'Kecamatan Bajeng', 'Kecamatan', NULL, 'Kecamatan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kec-05-kecamatan-bajeng-barat', 'KEC-05', 'Kecamatan Bajeng Barat', 'Kecamatan', NULL, 'Kecamatan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kec-06-kecamatan-bontonompo', 'KEC-06', 'Kecamatan Bontonompo', 'Kecamatan', NULL, 'Kecamatan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kec-07-kecamatan-bontonompo-selatan', 'KEC-07', 'Kecamatan Bontonompo Selatan', 'Kecamatan', NULL, 'Kecamatan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kec-08-kecamatan-bontomarannu', 'KEC-08', 'Kecamatan Bontomarannu', 'Kecamatan', NULL, 'Kecamatan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kec-09-kecamatan-parangloe', 'KEC-09', 'Kecamatan Parangloe', 'Kecamatan', NULL, 'Kecamatan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kec-10-kecamatan-pattalassang', 'KEC-10', 'Kecamatan Pattalassang', 'Kecamatan', NULL, 'Kecamatan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kec-11-kecamatan-manuju', 'KEC-11', 'Kecamatan Manuju', 'Kecamatan', NULL, 'Kecamatan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kec-12-kecamatan-tinggimoncong', 'KEC-12', 'Kecamatan Tinggimoncong', 'Kecamatan', NULL, 'Kecamatan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kec-13-kecamatan-parigi', 'KEC-13', 'Kecamatan Parigi', 'Kecamatan', NULL, 'Kecamatan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kec-14-kecamatan-tombolopao', 'KEC-14', 'Kecamatan Tombolopao', 'Kecamatan', NULL, 'Kecamatan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kec-15-kecamatan-bungaya', 'KEC-15', 'Kecamatan Bungaya', 'Kecamatan', NULL, 'Kecamatan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kec-16-kecamatan-biringbulu', 'KEC-16', 'Kecamatan Biringbulu', 'Kecamatan', NULL, 'Kecamatan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kec-17-kecamatan-tompobulu', 'KEC-17', 'Kecamatan Tompobulu', 'Kecamatan', NULL, 'Kecamatan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kec-18-kecamatan-bontolempangan', 'KEC-18', 'Kecamatan Bontolempangan', 'Kecamatan', NULL, 'Kecamatan', NULL, NULL, NULL);

INSERT INTO `app_sequences` (`name`, `value`)
VALUES ('reports', 0)
ON DUPLICATE KEY UPDATE `value` = `value`;
USE `db-sppd`;
DELETE FROM `rooms`;
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('asisten-asisten-pemerintahan-dan-kesejahteraan-rakyat', 'AST-01', 'Asisten Pemerintahan dan Kesejahteraan Rakyat', 'Asisten', NULL, 'Asisten', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('asisten-asisten-ekonomi-dan-pembangunan', 'AST-02', 'Asisten Ekonomi dan Pembangunan', 'Asisten', NULL, 'Asisten', 'MUHAMMAD IRWAN, SE', '085340770505', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('asisten-asisten-administrasi-umum', 'AST-03', 'Asisten Administrasi Umum', 'Asisten', NULL, 'Asisten', 'Drs. FIRMAN DJAMALUDDIN, MM', '0811444411', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('staf-ahli-staf-ahli-bidang-pemerintahan', 'SAH-01', 'Staf Ahli Bidang Pemerintahan', 'Staf Ahli', NULL, 'Staf Ahli', 'MUH. TASLIM, SH, MH', '081342400089', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('staf-ahli-staf-ahli-bidang-ekonomi-dan-pembangunan', 'SAH-02', 'Staf Ahli Bidang Ekonomi dan Pembangunan', 'Staf Ahli', NULL, 'Staf Ahli', 'SUGENG PRIYANTO, S.Hut, S.TP', '081355227807', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('staf-ahli-staf-ahli-bidang-kesra-dan-sosial', 'SAH-03', 'Staf Ahli Bidang Kesra dan Sosial', 'Staf Ahli', NULL, 'Staf Ahli', 'DJAFARUDDIN. BN, SE', '085329914444', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-sekretariat-dprd', 'DIN-01', 'Sekretariat DPRD', 'Dinas', NULL, 'Dinas', 'Drs. ANDI IDIL HAFID, M.Si', '081243712431', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-inspektorat', 'DIN-02', 'Inspektorat', 'Dinas', NULL, 'Dinas', 'ANDY AZIS, SH, MH', '081343949050 / 08114130209', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-koperasi-dan-usaha-kecil-menengah', 'DIN-03', 'Dinas Koperasi dan Usaha Kecil Menengah', 'Dinas', NULL, 'Dinas', 'Ir. MAHMUDDIN, M.Si', '0811443368', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-perumahan-kawasan-permukiman-dan-pertanahan', 'DIN-04', 'Dinas Perumahan, Kawasan Permukiman dan Pertanahan', 'Dinas', NULL, 'Dinas', 'Drs. ABDULLAH SIRAJUDDIN, M.Si', '0811445269', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-pekerjaan-umum-dan-penataan-ruang', 'DIN-05', 'Dinas Pekerjaan Umum dan Penataan Ruang', 'Dinas', NULL, 'Dinas', 'Ir. RUSDY ALIMUDDIN', '082187115777', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-perdagangan-dan-perindustrian', 'DIN-06', 'Dinas Perdagangan dan Perindustrian', 'Dinas', NULL, 'Dinas', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-tanaman-pangan-dan-holtikultura', 'DIN-07', 'Dinas Tanaman Pangan dan Holtikultura', 'Dinas', NULL, 'Dinas', 'Drs. M. FAJARUDDIN, MM', '08124282226', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-perpustakaan-dan-kearsipan', 'DIN-08', 'Dinas Perpustakaan dan Kearsipan', 'Dinas', NULL, 'Dinas', 'RATNAWATI, SE, M.Ed', '082189220123', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-kependudukan-dan-pencatatan-sipil', 'DIN-09', 'Dinas Kependudukan dan Pencatatan Sipil', 'Dinas', NULL, 'Dinas', 'EDY SUCIPTO, S.PI, MM', '081445199 / 081242901532', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-tenaga-kerja-dan-transmigrasi', 'DIN-10', 'Dinas Tenaga Kerja dan Transmigrasi', 'Dinas', NULL, 'Dinas', 'MUHAMMAD SABIR, S.Sos', '081342467500', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-perkebunan-dan-peternakan', 'DIN-11', 'Dinas Perkebunan dan Peternakan', 'Dinas', NULL, 'Dinas', 'SUHRIATI, SE, M.Si', '082188883869', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-perikanan-dan-kelautan', 'DIN-12', 'Dinas Perikanan dan Kelautan', 'Dinas', NULL, 'Dinas', 'MARSUKI, S.Sos, MM', '08124138772', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-pariwisata-dan-kebudayaan', 'DIN-13', 'Dinas Pariwisata dan Kebudayaan', 'Dinas', NULL, 'Dinas', 'ANDI TENRIWATI TAHRI, S.STP', '081342750804', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-perhubungan', 'DIN-14', 'Dinas Perhubungan', 'Dinas', NULL, 'Dinas', 'FIRDAUS, S.Sos, M.Si', '085242541454', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-kesehatan', 'DIN-15', 'Dinas Kesehatan', 'Dinas', NULL, 'Dinas', 'drg. ABDUL HARIS USMAN', '082324251973', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-pemberdayaan-perempuan-dan-perlindungan-anak', 'DIN-16', 'Dinas Pemberdayaan Perempuan dan Perlindungan Anak', 'Dinas', NULL, 'Dinas', 'KAWAIDAH ALHAM, S.Sos, M.Si', '081343510199 / 081241663057', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-pemberdayaan-masyarakat-dan-desa', 'DIN-17', 'Dinas Pemberdayaan Masyarakat dan Desa', 'Dinas', NULL, 'Dinas', 'MUH. BASIR, S.Sos', '085342724833', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-komunikasi-informatika-statistik-dan-persandian', 'DIN-18', 'Dinas Komunikasi, Informatika, Statistik dan Persandian', 'Dinas', NULL, 'Dinas', 'Drs. ARIFUDDIN SAENI', '081343733350', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-pemuda-dan-olahraga', 'DIN-19', 'Dinas Pemuda dan Olahraga', 'Dinas', NULL, 'Dinas', 'ANDRY MAURITZ. MK, S.Sos, MM', '081343641666', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-sosial', 'DIN-20', 'Dinas Sosial', 'Dinas', NULL, 'Dinas', 'H. SYAMSUDDIN BIDOL, S.Sos, M.Si', '0811467966', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-pendidikan', 'DIN-21', 'Dinas Pendidikan', 'Dinas', NULL, 'Dinas', 'Ir. TAUFIQ MURSAD, M.Si', '08114110210', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-pengendalian-penduduk-dan-keluarga-berencana', 'DIN-22', 'Dinas Pengendalian Penduduk dan Keluarga Berencana', 'Dinas', NULL, 'Dinas', 'SOFYAN DAUD, S.Sos, MM', '081343669001', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-ketahanan-pangan', 'DIN-23', 'Dinas Ketahanan Pangan', 'Dinas', NULL, 'Dinas', 'SYAMHARI, S.Ag, MH', '082344764977', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-lingkungan-hidup', 'DIN-24', 'Dinas Lingkungan Hidup', 'Dinas', NULL, 'Dinas', 'AZHARI AZIS, AP, MM', '085397706454', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-pemadam-kebakaran-dan-penyelamatan', 'DIN-25', 'Dinas Pemadam Kebakaran dan Penyelamatan', 'Dinas', NULL, 'Dinas', 'Drs. ROSTAM RAZAK', '08124108484', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('dinas-dinas-penanaman-modal-dan-pelayanan-terpadu-satu-pintu', 'DIN-26', 'Dinas Penanaman Modal dan Pelayanan Terpadu Satu Pintu', 'Dinas', NULL, 'Dinas', 'H. INDRA SETIAWAN ABBAS, S.Sos, M.Si', '08114210080', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('badan-badan-pendapatan-daerah', 'BAD-01', 'Badan Pendapatan Daerah', 'Badan', NULL, 'Badan', 'INDRA WAHYUDI YUSUF, SE, M.Adm.SDA', '082199999238', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('badan-badan-pengelolaan-keuangan-daerah', 'BAD-02', 'Badan Pengelolaan Keuangan Daerah', 'Badan', NULL, 'Badan', 'ABD KARIM DANIA, SE, MM', '08114101264', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('badan-badan-perencanaan-dan-pembangunan-daerah', 'BAD-03', 'Badan Perencanaan dan Pembangunan Daerah', 'Badan', NULL, 'Badan', 'SUJADDAN, S.STP, M.Si', '085242719777', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('badan-badan-penelitian-dan-pengembangan-daerah', 'BAD-04', 'Badan Penelitian dan Pengembangan Daerah', 'Badan', NULL, 'Badan', NULL, NULL, NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('badan-badan-penanggulangan-bencana-daerah', 'BAD-05', 'Badan Penanggulangan Bencana Daerah', 'Badan', NULL, 'Badan', 'Drs. H. IKHSAN PARAWANGSA, M.Si', '0811413613', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('badan-badan-kepegawaian-dan-pengembangan-sdm', 'BAD-06', 'Badan Kepegawaian dan Pengembangan SDM', 'Badan', NULL, 'Badan', 'ZUBAIR USMAN, S.STP, M.Si', '082190662379', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('badan-badan-kesatuan-bangsa-dan-politik', 'BAD-07', 'Badan Kesatuan Bangsa dan Politik', 'Badan', NULL, 'Badan', 'MAPPASOMBA, SE', '081241051965', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('badan-satuan-polisi-pamong-praja', 'BAD-08', 'Satuan Polisi Pamong Praja', 'Badan', NULL, 'Badan', 'ALIMUDDIN, SE, MM', '081342301555', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('badan-rsud-syekh-yusuf', 'BAD-09', 'RSUD Syekh Yusuf', 'Badan', NULL, 'Badan', 'drg. RAHMAWATI DJALIL', '08114104005', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bagian-bagian-tata-pemerintahan', 'BAG-01', 'Bagian Tata Pemerintahan', 'Bagian', NULL, 'Bagian', 'WAHYUDDIN, MP, SH, M.AP', '081242788883', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bagian-bagian-hukum', 'BAG-02', 'Bagian Hukum', 'Bagian', NULL, 'Bagian', 'ANDI CHAERIAH, SH, MH', '0811460646', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bagian-bagian-protokol-dan-komunikasi-pimpinan', 'BAG-03', 'Bagian Protokol dan Komunikasi Pimpinan', 'Bagian', NULL, 'Bagian', 'ARY MAHDIN ASFARY, S.STP, M.Si', '08114456111', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bagian-bagian-kesejahteraan-rakyat', 'BAG-04', 'Bagian Kesejahteraan Rakyat', 'Bagian', NULL, 'Bagian', 'TAUFIK. M. AKIB, S.STP', '081242758888', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bagian-bagian-pengadaan-barang-jasa', 'BAG-05', 'Bagian Pengadaan Barang/Jasa', 'Bagian', NULL, 'Bagian', 'AISYAH NAJAMUDDIN, S.Pd, M.M', '081355676440', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bagian-bagian-kerjasama', 'BAG-06', 'Bagian Kerjasama', 'Bagian', NULL, 'Bagian', 'HJ. EMY PRATIWI HOSEN, S.IP, M.Si', '082271450703', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bagian-bagian-umum', 'BAG-07', 'Bagian Umum', 'Bagian', NULL, 'Bagian', 'AGUS SALIM HARAHAP, S.Sos', '0811462766', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bagian-bagian-perencanaan-dan-keuangan', 'BAG-08', 'Bagian Perencanaan dan Keuangan', 'Bagian', NULL, 'Bagian', 'AKHMAD, S.Sos, MM', '08124286705', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bagian-bagian-perekonomian-dan-administrasi-pembangunan', 'BAG-09', 'Bagian Perekonomian dan Administrasi Pembangunan', 'Bagian', NULL, 'Bagian', 'H. MUH. AMIN, S.ST, M.Pd', '081245360413', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('bagian-bagian-organisasi', 'BAG-10', 'Bagian Organisasi', 'Bagian', NULL, 'Bagian', 'TAUFIQ, S.Si, M.Si', '085255625284', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kecamatan-kecamatan-somba-opu', 'KEC-01', 'Kecamatan Somba Opu', 'Kecamatan', NULL, 'Kecamatan', 'AGUSSALIM, S.Sos, M.Si', '081343948669', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kecamatan-kecamatan-pallangga', 'KEC-02', 'Kecamatan Pallangga', 'Kecamatan', NULL, 'Kecamatan', 'SACHRIAL, S.Sos', '085398942800', 'sekretaris');
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kecamatan-kecamatan-barombong', 'KEC-03', 'Kecamatan Barombong', 'Kecamatan', NULL, 'Kecamatan', 'ABD. RACHMAN, S.STP', '081342069012', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kecamatan-kecamatan-bajeng', 'KEC-04', 'Kecamatan Bajeng', 'Kecamatan', NULL, 'Kecamatan', 'SITTI HAERANI, S.Sos', '081356600072', 'tidak ada wa camat dan sekcam');
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kecamatan-kecamatan-bajeng-barat', 'KEC-05', 'Kecamatan Bajeng Barat', 'Kecamatan', NULL, 'Kecamatan', 'SYAMSURIJAL, SE', '081241099187', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kecamatan-kecamatan-bontonompo', 'KEC-06', 'Kecamatan Bontonompo', 'Kecamatan', NULL, 'Kecamatan', 'H. MUHAMMAD SYAHRIR, S.Ag, M.Si', '081342410494', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kecamatan-kecamatan-bontonompo-selatan', 'KEC-07', 'Kecamatan Bontonompo Selatan', 'Kecamatan', NULL, 'Kecamatan', 'DANIYAL, SS, M.Si', '081343546428', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kecamatan-kecamatan-bontomarannu', 'KEC-08', 'Kecamatan Bontomarannu', 'Kecamatan', NULL, 'Kecamatan', 'MUHAMMAD SYAFAAT SURYA ATMAJA, SP', '08114174773', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kecamatan-kecamatan-parangloe', 'KEC-09', 'Kecamatan Parangloe', 'Kecamatan', NULL, 'Kecamatan', 'MUH. NUR AGUNG MK, S.STP', '081381677791', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kecamatan-kecamatan-pattalassang', 'KEC-10', 'Kecamatan Pattalassang', 'Kecamatan', NULL, 'Kecamatan', 'A. PANGERAN ZUBAIR, SE', '081340261350', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kecamatan-kecamatan-manuju', 'KEC-11', 'Kecamatan Manuju', 'Kecamatan', NULL, 'Kecamatan', 'MARHAM, S.Pd', '085298417711', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kecamatan-kecamatan-tinggimoncong', 'KEC-12', 'Kecamatan Tinggimoncong', 'Kecamatan', NULL, 'Kecamatan', 'IIS NUR ISMI, S.STP', '085222128459', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kecamatan-kecamatan-parigi', 'KEC-13', 'Kecamatan Parigi', 'Kecamatan', NULL, 'Kecamatan', 'NURAENY APRIYANI, S.STP', '082193961231', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kecamatan-kecamatan-tombolopao', 'KEC-14', 'Kecamatan Tombolopao', 'Kecamatan', NULL, 'Kecamatan', 'ASTAN, S.Sos', '081354860134', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kecamatan-kecamatan-bungaya', 'KEC-15', 'Kecamatan Bungaya', 'Kecamatan', NULL, 'Kecamatan', 'IDRIS KENANG, SP', '082188421966', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kecamatan-kecamatan-biringbulu', 'KEC-16', 'Kecamatan Biringbulu', 'Kecamatan', NULL, 'Kecamatan', 'H. MUH. NATSIR, S.Sos', '082291495191', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kecamatan-kecamatan-tompobulu', 'KEC-17', 'Kecamatan Tompobulu', 'Kecamatan', NULL, 'Kecamatan', 'HARIFUDDIN, SE, MM', '082345287999', NULL);
INSERT INTO `rooms` (`id`, `code`, `name`, `building`, `floor`, `category`, `leader`, `phone`, `note`) VALUES ('kecamatan-kecamatan-bontolempangan', 'KEC-18', 'Kecamatan Bontolempangan', 'Kecamatan', NULL, 'Kecamatan', 'AL ASHAR, S.STP', '082411651789', NULL);

