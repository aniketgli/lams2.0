-- Migration: holiday calendar in the database (was browser storage).
-- Safe to re-run.
--
--   holidays   one row per holiday; managed by administrators on the Holiday Calendar page,
--              every change written to master_audit_logs (master_key = 'holiday').
--   type       gazetted | restricted | event (office open; see 20261030_holiday_types.sql)
--   category   National | Religious | Cultural | Institutional | International | Other

CREATE TABLE IF NOT EXISTS holidays (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  holiday_date  DATE         NOT NULL,
  name          VARCHAR(150) NOT NULL,
  hindi_name    VARCHAR(150) NULL,
  type          VARCHAR(20)  NOT NULL,
  category      VARCHAR(40)  NOT NULL,
  description   VARCHAR(500) NULL,
  created_by    VARCHAR(4)   NULL,
  updated_by    VARCHAR(4)   NULL,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_holiday_date_name (holiday_date, name),
  KEY idx_holiday_date (holiday_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The 2026 list the portal showed until now. Existing rows are never overwritten;
-- administrators should check it against the official order and correct it on the page.
INSERT IGNORE INTO holidays (holiday_date, name, hindi_name, type, category, description) VALUES
  ('2026-01-26', 'Republic Day', 'गणतंत्र दिवस', 'gazetted', 'National', 'National holiday marking the adoption of the Constitution of India in 1950.'),
  ('2026-03-21', 'Id-ul-Fitr', 'ईद-उल-फ़ित्र', 'gazetted', 'Religious', 'Islamic festival marking the end of Ramadan, the holy month of fasting.'),
  ('2026-03-27', 'Holi', 'होली', 'gazetted', 'Cultural', 'Ancient Hindu Festival of Colours celebrating spring, love, and the triumph of good over evil.'),
  ('2026-04-03', 'Good Friday', 'गुड फ्राइडे', 'gazetted', 'Religious', 'Christian holiday commemorating the crucifixion of Jesus Christ at Calvary.'),
  ('2026-04-14', 'Dr. B.R. Ambedkar Jayanti', 'डॉ. बी.आर. अम्बेडकर जयंती', 'gazetted', 'National', 'Birth anniversary of Dr. Bhimrao Ramji Ambedkar, father of the Indian Constitution.'),
  ('2026-05-01', 'Mahavir Jayanti', 'महावीर जयंती', 'gazetted', 'Religious', 'Most important religious festival in Jainism celebrating the birth of Lord Mahavira.'),
  ('2026-05-31', 'Buddha Purnima', 'बुद्ध पूर्णिमा', 'gazetted', 'Religious', 'Festival commemorating the birth, enlightenment, and death of Gautama Buddha.'),
  ('2026-05-28', 'Bakrid / Id-ul-Zuha', 'ईद-उल-जुहा (बकरीद)', 'gazetted', 'Religious', 'Feast of the Sacrifice honoring the willingness of Ibrahim to sacrifice his son.'),
  ('2026-06-26', 'Muharram', 'मुहर्रम', 'gazetted', 'Religious', 'The first month of the Islamic calendar; Ashura commemorates the martyrdom of Imam Hussain.'),
  ('2026-08-15', 'Independence Day', 'स्वतंत्रता दिवस', 'gazetted', 'National', 'National holiday marking the nation’s independence from British rule in 1947.'),
  ('2026-08-26', 'Milad-un-Nabi (Id-e-Milad)', 'ईद-ए-मिलाद', 'gazetted', 'Religious', 'Observance of the birthday of the Islamic prophet Muhammad.'),
  ('2026-10-02', 'Mahatma Gandhi Birthday', 'गांधी जयंती', 'gazetted', 'National', 'Birth anniversary of Mohandas Karamchand Gandhi, Father of the Nation.'),
  ('2026-10-20', 'Dussehra (Vijay Dashami)', 'दशहरा (विजयदशमी)', 'gazetted', 'Cultural', 'Major Hindu festival celebrating the victory of Lord Rama over Ravana.'),
  ('2026-11-08', 'Diwali (Deepavali)', 'दीपावली', 'gazetted', 'Cultural', 'Hindu festival of lights symbolizing spiritual victory of light over darkness.'),
  ('2026-11-24', 'Guru Nanak Jayanti', 'गुरु नानक जयंती', 'gazetted', 'Religious', 'Gurpurab celebrating the birth of the first Sikh Guru, Guru Nanak Dev Ji.'),
  ('2026-12-25', 'Christmas Day', 'क्रिसमस', 'gazetted', 'Religious', 'Annual Christian festival celebrating the birth of Jesus Christ.'),
  ('2026-11-09', 'Uttarakhand State Foundation Day', 'उत्तराखंड राज्य स्थापना दिवस', 'gazetted', 'Institutional', 'Dehradun Institute / Regional holiday commemorating the formation of Uttarakhand state.'),
  ('2026-01-01', 'New Year’s Day', 'नव वर्ष दिवस', 'restricted', 'Cultural', 'First day of the Gregorian year.'),
  ('2026-01-14', 'Makar Sankranti / Pongal / Magha Bihu', 'मकर संक्रांति / पोंगल', 'restricted', 'Cultural', 'Sun transition into Capricorn; harvest festival across Indian states.'),
  ('2026-02-02', 'Guru Ravidas Jayanti', 'गुरु रविदास जयंती', 'restricted', 'Religious', 'Birthday of mystic poet-sant Ravidas.'),
  ('2026-02-15', 'Maha Shivratri', 'महाशिवरात्रि', 'restricted', 'Religious', 'Night of Lord Shiva, marked by prayer and devotion.'),
  ('2026-03-26', 'Holika Dahan', 'होलिका दहन', 'restricted', 'Cultural', 'Eve of Holi symbolizing bonfire burning of evil spirit Holika.'),
  ('2026-04-05', 'Easter Sunday', 'ईस्टर संडे', 'restricted', 'Religious', 'Christian festival celebrating the resurrection of Jesus Christ.'),
  ('2026-04-14', 'Vaisakhi / Vishu / Meshadi', 'वैशाखी / विशु', 'restricted', 'Cultural', 'Solar new year and spring harvest festival in North/South India.'),
  ('2026-05-09', 'Guru Rabindranath Tagore Birthday', 'रवींद्रनाथ टैगोर जयंती', 'restricted', 'Cultural', 'Birth anniversary of Nobel Laureate Rabindranath Tagore.'),
  ('2026-07-16', 'Rath Yatra', 'रथ यात्रा', 'restricted', 'Religious', 'Chariot procession festival of Lord Jagannath.'),
  ('2026-08-28', 'Raksha Bandhan', 'रक्षा बंधन', 'restricted', 'Cultural', 'Sacred bond and protection festival between brothers and sisters.'),
  ('2026-09-04', 'Janmashtami (Smarta)', 'श्री कृष्ण जन्माष्टमी', 'restricted', 'Religious', 'Celebration of the birth of Lord Krishna, eighth avatar of Vishnu.'),
  ('2026-09-14', 'Ganesh Chaturthi', 'गणेश चतुर्थी', 'restricted', 'Religious', 'Arrival of Lord Ganesha to Earth, celebrating wisdom and prosperity.'),
  ('2026-10-19', 'Maha Ashtami / Maha Navami', 'महाअष्टमी / महानवमी', 'restricted', 'Religious', 'Durga Puja main celebration days.'),
  ('2026-10-29', 'Karwa Chauth', 'करवा चौथ', 'restricted', 'Cultural', 'Fasting day observed by married women for longevity and safety of spouses.'),
  ('2026-11-09', 'Govardhan Puja', 'गोवर्धन पूजा', 'restricted', 'Religious', 'Annakut festival commemorating Krishna lifting Govardhan hill.'),
  ('2026-11-10', 'Bhai Duj', 'भाई दूज', 'restricted', 'Cultural', 'Celebration of fraternal bond following Diwali festivities.'),
  ('2026-11-15', 'Chhath Puja', 'छठ पूजा (सूर्य षष्ठी)', 'restricted', 'Cultural', 'Ancient Vedic festival dedicated to the Sun God Surya and Chhathi Maiya.'),
  ('2026-12-24', 'Christmas Eve', 'क्रिसमस संध्या', 'restricted', 'Religious', 'Evening before Christmas Day.');
