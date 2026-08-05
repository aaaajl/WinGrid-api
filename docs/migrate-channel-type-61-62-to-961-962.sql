-- Remap fork channel types after rebase onto upstream NewAPI/Sub2API IDs.
--
-- Live DB (pre-remap) used the original fork allocations:
--   HappyHorse: 59 -> 961
--   Agnes Video: 60 -> 962
--
-- Also accepts an intermediate remap if any rows already used 61/62:
--   HappyHorse: 61 -> 961
--   Agnes Video: 62 -> 962
--
-- Abilities join channels by channel_id (no type column), so only channels.type
-- and historical tasks.platform need updating.
-- Safe to re-run: UPDATE only matches the old type values.
--
-- After applying: reload channel/ability cache (restart or admin refresh).

BEGIN;

-- Preview (optional):
-- SELECT id, name, type, status, models FROM channels
--   WHERE type IN (59, 60, 61, 62, 961, 962) ORDER BY type, id;
-- SELECT platform, COUNT(*) FROM tasks
--   WHERE platform IN ('59','60','61','62','961','962') GROUP BY platform;

-- HappyHorse
UPDATE channels SET type = 961 WHERE type IN (59, 61);
UPDATE tasks SET platform = '961' WHERE platform IN ('59', '61');

-- Agnes Video
UPDATE channels SET type = 962 WHERE type IN (60, 62);
UPDATE tasks SET platform = '962' WHERE platform IN ('60', '62');

COMMIT;

-- Verify:
-- SELECT id, name, type, status, models FROM channels
--   WHERE type IN (59, 60, 61, 62, 961, 962) ORDER BY type, id;
-- SELECT platform, COUNT(*) FROM tasks
--   WHERE platform IN ('59','60','61','62','961','962') GROUP BY platform;
