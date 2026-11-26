-- =============================================================================================
-- PMS projects: the first 80 projects (title and PI) given by the RC office
-- =============================================================================================
-- Adds the projects below to the Projects module (PMS → Projects), stage "Ongoing".
--   * Only adds rows: a project whose title already exists is skipped; no row is changed or deleted.
--   * Code: given automatically, continuing WII-PRJ-NNNN after the highest existing one.
--   * PI: the name in the list is matched to an active employee (HRMS / PMS), and the project keeps the
--     EMPLOYEE'S name as in the portal (pi_name) and is linked to that employee (pi_user_id):
--       1. exactly the same name;  2. the same words in order ("Dr. Bilal Habib");
--       3. a known short form (e.g. "K. Ramesh", "G.V. Gopi", "R. Suresh Kumar").
--     A PI is linked only when exactly ONE employee matches at the first step that finds anyone. Otherwise the
--     name from the list is kept and the PI can be chosen later in the project form.
--   * Two titles come twice in the list with two PIs: the first is the PI, the second is added as Co-PI.
-- At the end: every PI with the employee it was linked to (check them), the PIs not linked, and the linked PIs
-- who do not yet have the PMS Reporting Manager role (give it in HRMS → User Controls, PMS column).
-- Safe to run again (the second run adds nothing). Run after a backup.
-- =============================================================================================

DROP TEMPORARY TABLE IF EXISTS tmp_pms_projects;
DROP TEMPORARY TABLE IF EXISTS tmp_pi_patterns;
DROP TEMPORARY TABLE IF EXISTS tmp_pi_hits;
DROP TEMPORARY TABLE IF EXISTS tmp_pi_first;
DROP TEMPORARY TABLE IF EXISTS tmp_pi_link;

-- Same column types and collation as the real tables, so names compare without collation errors.
CREATE TEMPORARY TABLE tmp_pms_projects AS
  SELECT 0 AS seq, name AS title, pi_name AS list_pi, pi_name AS list_co_pi FROM projects WHERE 1 = 0;
INSERT INTO tmp_pms_projects (seq, title, list_pi, list_co_pi) VALUES
  (1, 'Assessment of Wildlife Values and the Impact of Water Submergence on the habitat of Gharial upstream from the Sadrapur Barrage construction site across Yamuna River up to National Chambal Wildlife Sanctuary, Uttar Pradesh', 'Abhijit Das', NULL),
  (2, 'Conservation and Management of the critically endangered gharial (Gavialis gangeticus) in India', 'Abhijit Das', NULL),
  (3, 'Conservation and management plan of Saltwater Crocodile (Crocodylus porosus) in Great Nicobar Island', 'Abhijit Das', NULL),
  (4, 'Cumulative impact assessment and preparation of Mitigation plan for the proposed Hubballi-Ankola Railway Line Project', 'Abhijit Das', NULL),
  (5, 'Diversity and population status of snakes in selected protected areas of Madhya Pradesh', 'Abhijit Das', NULL),
  (6, 'Preparing Long-term monitoring protocol for Amphibians, Reptiles and Fishes in Keoladeo National Park, Bharatpur, Rajasthan', 'Abhijit Das', NULL),
  (7, 'Reviving Batagur baska: A Strategic Conservation Approach for Ensuring Survival of the Critically Endangered Terrapins', 'Abhijit Das', NULL),
  (8, 'Assessing Elephant Corridors, Habitat Utilization, and Conflict Hotspots in the Bandhavgarh Region', 'Anukul Nath', NULL),
  (9, 'Assessment of Human Wildlife Interactions with a specific focus on actions for mitigating the human–elephant conflict in Wokha and Mokochung Districts, Nagaland', 'Anukul Nath', NULL),
  (10, 'All India Tiger Estimation (AITE 2026)', 'Bilal Habib', NULL),
  (11, 'Assessment of available infrastructures for tourist/ pilgrims in the concerned areas', 'Bilal Habib', NULL),
  (12, 'Biodiversity assessment, conservation and mitigation plan for the construction of 4/6 lane NH-744 crossing through Nellai Wildlife Sanctuary and ESZ of Shendurney Wildlife Sanctuary in Keralam and Tamil Nadu', 'Bilal Habib', NULL),
  (13, 'Biodiversity Assessment, Conservation and Mitigation Plan for the Shamli – Gorakhpur High-Speed Access Controlled Corridor Project (Phase-I), Package 1A and 1B, Uttar Pradesh', 'Bilal Habib', NULL),
  (14, 'Bringing Back Cheetah in India', 'Bilal Habib', NULL),
  (15, 'Cumulative Impact Assessment Study on Wildlife and its Habitat due to Proposed Access-Controlled Super Communication Expressways of Eastern Maharashtra for Mitigation Measures', 'Bilal Habib', 'Jeyaraj Antony Johnson'),
  (16, 'Enhancing the functionality of the transboundary Kamdi-Suhelwa complex for the management of dispersing tiger populations, through a communitycentered conservation approach', 'Bilal Habib', NULL),
  (17, 'Impact of Extended Reach Drilling/Horizontal & Deviation Drilling on the Above-Ground Biodiversity of Forest/Wildlife Areas in India', 'Bilal Habib', NULL),
  (18, 'Integrated Study of the Effects of Construction of the Twin Tunnel on Wildlife of Sanjay Gandhi National Park (SGNP)', 'Bilal Habib', NULL),
  (19, 'Long-Term Monitoring of Tigers, Co-Predators and Prey in Tiger Reserves and Other Tiger Bearing Areas of Vidarbha, Maharashtra', 'Bilal Habib', NULL),
  (20, 'Monitoring of Wildlife Overpasses and Underpasses on Samruddhi Expressway', 'Bilal Habib', NULL),
  (21, 'Monitoring of Wildlife Overpasses and Underpasses on Samruddhi Expressway Phase II', 'Bilal Habib', NULL),
  (22, 'Monitoring of Wildlife underpasses on Dehradun-Delhi Highway (NH – 307A)', 'Bilal Habib', NULL),
  (23, 'Monitoring System for Tigers – Intensive Protection and Ecological Status (M-STrIPES)', 'Bilal Habib', NULL),
  (24, 'Monitoring Wildlife Underpasses on Dehradun–Delhi Highway (NH-72A)', 'Bilal Habib', NULL),
  (25, 'PAN India Assessment and Monitoring of Endangered Species under the Integrated Development of Wildlife Habitats (IDWH) - Clouded Leopard', 'Bilal Habib', NULL),
  (26, 'Strengthening Conservation – Small Cat & Leopard Conservation', 'Bilal Habib', NULL),
  (27, 'Tiger Cell', 'Bilal Habib', NULL),
  (28, 'Understanding the movements and nesting beach dynamics of olive ridley sea turtles along the Odisha coast', 'Bilal Habib', 'Ramani Suresh Kumar'),
  (29, 'Identifying effective wildlife management interventions for replication', 'Bivash Pandav', NULL),
  (30, 'Long-term research and conservation interventions in and around Tiger Reserves of Odisha', 'Bivash Pandav', NULL),
  (31, 'Global Best Standards for Wildlife Conservation for India', 'Gautam Hirak Talukdar', NULL),
  (32, 'MEE - CMPA Project', 'Gautam Hirak Talukdar', NULL),
  (33, 'PAN India: Assessment and Monitoring of Endangered Species under the Integrated Development of Wildlife Habitats IDWH: Select habitat monitoring of critical endangered species', 'Gautam Hirak Talukdar', NULL),
  (34, 'Preparation of Nomination Dossier of Kanger Valley National Park, Jagdalpur, (Chhattisgarh)', 'Gautam Hirak Talukdar', NULL),
  (35, 'Wildlife Vision Plan for Viksit Bharat-2047', 'Gautam Hirak Talukdar', NULL),
  (36, 'Conservation Advisory and Policy Cell', 'Gopi', NULL),
  (37, 'Conservation Plan for the Critically Endangered White Bellied Heron (Ardea insignis) and its habitats in the Lohit River and Noa- Dehing River Basins', 'Gopi', NULL),
  (38, 'Geospatial Analysis of the Impacts of Lower Demwe Hydroelectric Project on the Riverine Ecosystems of Lohit Basin', 'Gopi', NULL),
  (39, 'Preparation of Comprehensive Site-Specific Wildlife Management Plan for Sijimali Bauxite Mines in Rayagada Forest Division & Kalahandi (South) Forest Division, Odisha', 'Gopi', NULL),
  (40, 'Preparation of Wildlife Mitigation/Management Plan for the Yettinahole Drinking Water Project in Hassan and Tumkur Districts, Karnataka', 'Gopi', NULL),
  (41, 'Review of Wildlife Conservation Plan (WCP) for Barjora (North) Coal Mine Project', 'Gopi', NULL),
  (42, 'Assessment and Monitoring of Climate Change Effects on Wildlife Species and Ecosystems for Developing Adaptation Strategies in the Indian Himalayan Region under NMSHE Phase II', 'Jeyaraj Antony Johnson', NULL),
  (43, 'Environmental Flow Assessment for Chambal and Tons Rivers at Critical Reaches', 'Jeyaraj Antony Johnson', NULL),
  (44, 'Monitoring Baleen Whales and other cetaceans in the Lakshadweep Archipelago India', 'Jeyaraj Antony Johnson', NULL),
  (45, 'Monitoring Freshwater Fish population in selected landscape of selected Indian landscapes with reference to the changing climate variables', 'Jeyaraj Antony Johnson', NULL),
  (46, 'Species Conservation Program CAMPA Dugong', 'Jeyaraj Antony Johnson', NULL),
  (47, 'Human-Wildlife Conflict Management and Zonal Management Plan for Tirumala Tirupati Devasthanam, Andhra Pradesh', 'Krishnamurthy Ramesh', NULL),
  (48, 'Implementation of Integrated Landscape Management Plan for Greater Panna Landscape, Madhya Pradesh and Uttar Pradesh', 'Krishnamurthy Ramesh', NULL),
  (49, 'Integrated Landscape Management Plan and Long-term Monitoring of Satpura Pench-Melghat Landscape Complex, Central India', 'Krishnamurthy Ramesh', NULL),
  (50, 'Recruitment and Placement Cell (RP Cell)', 'Krishnamurthy Ramesh', NULL),
  (51, 'Disease risk assessment of wild ungulates and carnivores in and around the Darra Enclosure of MHTR', 'Lallian Puii Kawlni', NULL),
  (52, 'Mangrove monitoring for climate change vulnerability and restoration effectiveness in the critical mangrove sites across Maharashtra', 'Nehru Prabhakaran', NULL),
  (53, 'Movement ecology and population connectivity of the endemic Nicobar Megapode (Megapodius nicobariensis) in the Nicobar archipelago', 'Nehru Prabhakaran', NULL),
  (54, 'Elephant Cell', 'Parag Nigam', NULL),
  (55, 'Conservation and long-term monitoring of Sea Turtles of the Andaman & Nicobar Islands with a special focus on the Leatherback Sea Turtle', 'Ramani Suresh Kumar', NULL),
  (56, 'Movement Ecology and Population Assessment of Select Migratory Waterbirds in Nalabana Bird Sanctuary, Chilika Lake, Odisha', 'Ramani Suresh Kumar', NULL),
  (57, 'Study on Central Asian Flyway migratory birds in Sundarbans', 'Ramani Suresh Kumar', NULL),
  (58, 'WII-Category 2 Centre on World Natural Heritage Management and Training for Asia and the Pacific region', 'Ramani Suresh Kumar', NULL),
  (59, 'Conservation and Management of Sloth Bear in India – A Landscape based Initiative', 'Ramesh Chinnasamy', NULL),
  (60, 'Environmental Information, Awareness, Capacity Building and Livelihood Programme (EIACP) Centre', 'Ramesh Chinnasamy', NULL),
  (61, 'Assessment and monitoring of biodiversity values in Saranda Forest Division, Jharkhand', 'Ritesh Kumar Gautam', NULL),
  (62, 'Assessment of Ecological status of the select Indian Rivers for conservation planning', 'Ruchi Badola', NULL),
  (63, 'CAMPA: Endangered Species Recovery Programme', 'Ruchi Badola', NULL),
  (64, 'Connecting river and people to realize arth Ganga', 'Ruchi Badola', NULL),
  (65, 'Conservation Action Plan for Manipur’s Brow-antlered Deer or Sangai: An Integrated Approach', 'Ruchi Badola', NULL),
  (66, 'Planning and Management for Aquatic Species Conservation and Maintenance of Eco-system in the Ganga River Basin for a Clean Ganga', 'Ruchi Badola', NULL),
  (67, 'Mammalian Population Assessment in the State of Meghalaya Across Protected and Fragmented Landscapes', 'Salvador Lyngdoh', NULL),
  (68, 'Developing genetic data base on Rhino horn stock pile of Assam to curb poaching threat and assess temporal change in genetic variation', 'Samrat Mondol', NULL),
  (69, 'Development of genetic database of captive elephants across India for welfare and management', 'Samrat Mondol', NULL),
  (70, 'Pashmina Certification Centre', 'Sandeep Kumar Gupta', NULL),
  (71, 'Wildlife Forensic and Conservation Genetics (WFCG) Cell', 'Sandeep Kumar Gupta', NULL),
  (72, 'Project Great Indian Bustard', 'Sutiratha Dutta', NULL),
  (73, 'Assessing the Status of Blackbuck and associated Human–Wildlife Conflict in and around Kaimoor wildlife Sanctuary', 'Tanveer Ahamed', NULL),
  (74, 'Biodiversity Assessment under the Project: Biodiversity Impact Assessment Report and Animal Passage Plan for the Proposed Road in Kaimoor Wildlife Sanctuary, Mirzapur District, Uttar Pradesh', 'Tanveer Ahamed', NULL),
  (75, 'Preparation of a site-specific wildlife management plan to mitigate the ecological impacts of proposed forest land diversion for mining in Bonai Forest Division, Sundargarh, Odisha', 'Tanveer Ahamed', NULL),
  (76, 'Preparing Biodiversity Impact Assessment Report and Animal Passage Plan for proposed road in Kaimoor Wildlfie Sanctuary', 'Tanveer Ahamed', NULL),
  (77, 'Development of a Metagenomics-based pathogen surveillance system at the human, livestock, and wildlife interface in Sariska Tiger Reserve', 'Tapendra Saini', NULL),
  (78, 'Impact Assessment of Vibrations on Aquatic Life and Biodiversity Due to Underwater Tunnel', 'Vishnupriya Kolipakam', NULL),
  (79, 'Rangewide Estimation of River Dolphin-2nd Cycle', 'Vishnupriya Kolipakam', NULL),
  (80, 'CoE-HWC', 'Ramesh T', NULL);

-- list_name: as projects.pi_name (to join the list); pat: as users.name (to match the employees).
CREATE TEMPORARY TABLE tmp_pi_patterns AS
  SELECT p.pi_name AS list_name, 0 AS prio, u.name AS pat FROM projects p JOIN users u ON 1 = 0 WHERE 1 = 0;
INSERT INTO tmp_pi_patterns (list_name, prio, pat) VALUES
  ('Abhijit Das', 1, '%abhijit%das%'),
  ('Abhijit Das', 2, 'a% das%'),
  ('Anukul Nath', 1, '%anukul%nath%'),
  ('Anukul Nath', 2, 'a% nath%'),
  ('Bilal Habib', 1, '%bilal%habib%'),
  ('Bilal Habib', 2, 'b% habib%'),
  ('Bivash Pandav', 1, '%bivash%pandav%'),
  ('Bivash Pandav', 2, '%pandav%'),
  ('Gautam Hirak Talukdar', 1, '%gautam%hirak%talukdar%'),
  ('Gautam Hirak Talukdar', 2, '%talukdar%'),
  ('Gopi', 1, '%gopi%'),
  ('Gopi', 2, '%gopi%'),
  ('Jeyaraj Antony Johnson', 1, '%jeyaraj%antony%johnson%'),
  ('Jeyaraj Antony Johnson', 2, '%johnson%'),
  ('Krishnamurthy Ramesh', 1, '%krishnamurthy%ramesh%'),
  ('Krishnamurthy Ramesh', 2, 'k% ramesh%'),
  ('Lallian Puii Kawlni', 1, '%lallian%puii%kawlni%'),
  ('Lallian Puii Kawlni', 2, '%kawlni%'),
  ('Lallian Puii Kawlni', 3, '%lallian%'),
  ('Nehru Prabhakaran', 1, '%nehru%prabhakaran%'),
  ('Nehru Prabhakaran', 2, '%prabhakaran%'),
  ('Parag Nigam', 1, '%parag%nigam%'),
  ('Parag Nigam', 2, 'p% nigam%'),
  ('Ramani Suresh Kumar', 1, '%ramani%suresh%kumar%'),
  ('Ramani Suresh Kumar', 2, '%suresh kumar%'),
  ('Ramesh Chinnasamy', 1, '%ramesh%chinnasamy%'),
  ('Ramesh Chinnasamy', 2, '%chinnasamy%'),
  ('Ramesh Chinnasamy', 3, 'c% ramesh%'),
  ('Ramesh T', 1, '%ramesh%t%'),
  ('Ramesh T', 2, 't% ramesh%'),
  ('Ramesh T', 3, 'ramesh t%'),
  ('Ritesh Kumar Gautam', 1, '%ritesh%kumar%gautam%'),
  ('Ritesh Kumar Gautam', 2, 'r% gautam%'),
  ('Ruchi Badola', 1, '%ruchi%badola%'),
  ('Ruchi Badola', 2, '%badola%'),
  ('Salvador Lyngdoh', 1, '%salvador%lyngdoh%'),
  ('Salvador Lyngdoh', 2, '%lyngdoh%'),
  ('Samrat Mondol', 1, '%samrat%mondol%'),
  ('Samrat Mondol', 2, '%mondol%'),
  ('Sandeep Kumar Gupta', 1, '%sandeep%kumar%gupta%'),
  ('Sandeep Kumar Gupta', 2, 's% gupta%'),
  ('Sutiratha Dutta', 1, '%sutiratha%dutta%'),
  ('Sutiratha Dutta', 2, '%sut%dutta%'),
  ('Tanveer Ahamed', 1, '%tanveer%ahamed%'),
  ('Tanveer Ahamed', 2, 't% ahamed%'),
  ('Tapendra Saini', 1, '%tapendra%saini%'),
  ('Tapendra Saini', 2, '%tapendra%'),
  ('Vishnupriya Kolipakam', 1, '%vishnupriya%kolipakam%'),
  ('Vishnupriya Kolipakam', 2, '%kolipakam%'),
  ('Abhijit Das', 0, 'abhijit das'),
  ('Anukul Nath', 0, 'anukul nath'),
  ('Bilal Habib', 0, 'bilal habib'),
  ('Bivash Pandav', 0, 'bivash pandav'),
  ('Gautam Hirak Talukdar', 0, 'gautam hirak talukdar'),
  ('Gopi', 0, 'gopi'),
  ('Jeyaraj Antony Johnson', 0, 'jeyaraj antony johnson'),
  ('Krishnamurthy Ramesh', 0, 'krishnamurthy ramesh'),
  ('Lallian Puii Kawlni', 0, 'lallian puii kawlni'),
  ('Nehru Prabhakaran', 0, 'nehru prabhakaran'),
  ('Parag Nigam', 0, 'parag nigam'),
  ('Ramani Suresh Kumar', 0, 'ramani suresh kumar'),
  ('Ramesh Chinnasamy', 0, 'ramesh chinnasamy'),
  ('Ramesh T', 0, 'ramesh t'),
  ('Ritesh Kumar Gautam', 0, 'ritesh kumar gautam'),
  ('Ruchi Badola', 0, 'ruchi badola'),
  ('Salvador Lyngdoh', 0, 'salvador lyngdoh'),
  ('Samrat Mondol', 0, 'samrat mondol'),
  ('Sandeep Kumar Gupta', 0, 'sandeep kumar gupta'),
  ('Sutiratha Dutta', 0, 'sutiratha dutta'),
  ('Tanveer Ahamed', 0, 'tanveer ahamed'),
  ('Tapendra Saini', 0, 'tapendra saini'),
  ('Vishnupriya Kolipakam', 0, 'vishnupriya kolipakam');


-- Who matches each pattern (names compared in lower case, dots read as spaces).
CREATE TEMPORARY TABLE tmp_pi_hits AS
  SELECT p.list_name, p.prio, COUNT(DISTINCT u.id) AS n, MIN(u.id) AS user_id
    FROM tmp_pi_patterns p
    JOIN users u ON u.is_system = 0 AND LOWER(u.status) = 'active'
     AND TRIM(REPLACE(LOWER(u.name), '.', ' ')) LIKE p.pat
   GROUP BY p.list_name, p.prio;
CREATE TEMPORARY TABLE tmp_pi_first AS SELECT list_name, MIN(prio) AS prio FROM tmp_pi_hits GROUP BY list_name;
CREATE TEMPORARY TABLE tmp_pi_link AS
  SELECT h.list_name, h.n, IF(h.n = 1, h.user_id, NULL) AS user_id
    FROM tmp_pi_hits h JOIN tmp_pi_first f ON f.list_name = h.list_name AND f.prio = h.prio;

SET @last := (SELECT COALESCE(MAX(CAST(SUBSTRING(code, 9) AS UNSIGNED)), 0) FROM projects WHERE code REGEXP '^WII-PRJ-[0-9]{4}$');

INSERT INTO projects (name, code, pi_name, pi_user_id, stage, status)
-- CAST: the sum is a decimal in MySQL (it gave "WII-PRJ-80.0"); the code needs the whole number.
SELECT x.title, CONCAT('WII-PRJ-', LPAD(CAST(@last + ROW_NUMBER() OVER (ORDER BY x.seq) AS UNSIGNED), 4, '0')),
       COALESCE(u.name COLLATE utf8mb4_unicode_ci, x.list_pi), u.id, 'ongoing', 'ACTIVE'
  FROM tmp_pms_projects x
  LEFT JOIN tmp_pi_link l ON l.list_name = x.list_pi
  LEFT JOIN users u ON u.id = l.user_id
 WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.name = x.title)
 ORDER BY x.seq;

-- The second PI of a title that came twice: Co-PI, when linked to one employee and not already the PI.
INSERT IGNORE INTO project_co_pis (project_id, user_id)
SELECT p.id, l.user_id
  FROM tmp_pms_projects x
  JOIN projects p ON p.name = x.title
  JOIN tmp_pi_link l ON l.list_name = x.list_co_pi AND l.user_id IS NOT NULL
 WHERE x.list_co_pi IS NOT NULL AND NOT (p.pi_user_id <=> l.user_id);

SELECT CONCAT('Projects from this list now in PMS: ', COUNT(*), ' of 80') AS result
  FROM projects p JOIN tmp_pms_projects x ON x.title = p.name;

-- 1. Check these: the name in the list and the employee it was linked to.
SELECT l.list_name AS pi_in_list, u.biometric_id, u.name AS linked_employee
  FROM tmp_pi_link l JOIN users u ON u.id = l.user_id ORDER BY l.list_name;

-- 2. Not linked (no employee, or more than one employee matched): choose the PI in the project form.
SELECT DISTINCT x.list_pi AS pi_not_linked, IF(l.n > 1, CONCAT(l.n, ' employees match'), 'no employee matches') AS why
  FROM tmp_pms_projects x LEFT JOIN tmp_pi_link l ON l.list_name = x.list_pi
 WHERE l.user_id IS NULL ORDER BY x.list_pi;

-- 3. Linked PIs without the PMS Reporting Manager role (HRMS → User Controls → PMS column → Reporting Manager).
SELECT u.biometric_id, u.name AS needs_pms_reporting_manager
  FROM tmp_pi_link l JOIN users u ON u.id = l.user_id
 WHERE NOT EXISTS (SELECT 1 FROM user_module_roles g WHERE g.biometric_id = u.biometric_id AND g.module_id = 'pms'
                     AND LOWER(g.status) = 'active' AND LOWER(g.role_id) IN ('reporting manager', 'pms_co_pi', 'co-pi', 'rm'))
 ORDER BY u.name;

DROP TEMPORARY TABLE tmp_pms_projects;
DROP TEMPORARY TABLE tmp_pi_patterns;
DROP TEMPORARY TABLE tmp_pi_hits;
DROP TEMPORARY TABLE tmp_pi_first;
DROP TEMPORARY TABLE tmp_pi_link;
