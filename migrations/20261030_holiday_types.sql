-- Migration: holiday types are now gazetted | restricted | event.
--   event = official event / observance (Earth Day, Global Tiger Day, …): the office stays open.
-- The old "local" type was a closed-office holiday, so it becomes gazetted.
-- Safe to re-run. "id > 0" keeps MySQL Workbench's Safe Updates mode happy.
UPDATE holidays SET type = 'gazetted' WHERE id > 0 AND type = 'local';
