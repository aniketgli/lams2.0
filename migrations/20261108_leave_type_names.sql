-- Leave type names are written without the code ("Casual Leave", not "Casual Leave (CL)"): screens show "name (code)"
-- themselves, so a name that already ends with its code appeared twice, e.g. "Casual Leave (CL) (CL)".
-- Only a trailing "(code)" equal to the leave type's own code is removed; nothing else is touched.
UPDATE leave_types
   SET name = TRIM(SUBSTRING(name, 1, CHAR_LENGTH(name) - CHAR_LENGTH(code) - 2))
 WHERE id > 0
   AND CHAR_LENGTH(name) > CHAR_LENGTH(code) + 2
   AND RIGHT(name, CHAR_LENGTH(code) + 2) = CONCAT('(', code, ')');

-- "Extra Ordinary Leave (EOL / LWP)" -> "Extra Ordinary Leave" (code EOL is shown next to it).
UPDATE leave_types SET name = 'Extra Ordinary Leave' WHERE id > 0 AND code = 'EOL' AND name = 'Extra Ordinary Leave (EOL / LWP)';
