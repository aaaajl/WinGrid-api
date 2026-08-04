-- M3: Cut over agnes-video-v2.0 from OpenAI (type=1) to Agnes Video (type=62).
-- Source channel for keys/settings: AgensGlobal (#26) by default.
-- Safe to re-run: skips insert if a type=62 channel already mounts agnes-video-v2.0.
--
-- After applying: reload channel/ability cache (restart or admin refresh) so routing picks up #30.

BEGIN;

INSERT INTO channels (
  type, key, open_ai_organization, test_model, status, name, weight,
  created_time, test_time, response_time, base_url, other, balance,
  balance_updated_time, models, "group", used_quota, model_mapping,
  status_code_mapping, priority, auto_ban, other_info, tag, setting,
  param_override, header_override, remark, channel_info, settings
)
SELECT
  62,
  key,
  open_ai_organization,
  'agnes-video-v2.0',
  1,
  'Agnes Video CN',
  COALESCE(weight, 0),
  EXTRACT(EPOCH FROM NOW())::bigint,
  0,
  0,
  'https://api.agnes-ai.cn',
  other,
  0,
  0,
  'agnes-video-v2.0',
  "group",
  0,
  model_mapping,
  status_code_mapping,
  13,
  auto_ban,
  other_info,
  tag,
  setting,
  param_override,
  header_override,
  'Migrated from AgensGlobal for ChannelTypeAgnesVideo=62',
  channel_info,
  settings
FROM channels
WHERE id = 26
  AND NOT EXISTS (
    SELECT 1 FROM channels WHERE type = 62 AND models LIKE '%agnes-video-v2.0%'
  );

INSERT INTO abilities ("group", model, channel_id, enabled, priority, weight)
SELECT c."group", 'agnes-video-v2.0', c.id, true, COALESCE(c.priority, 13), COALESCE(c.weight, 0)
FROM channels c
WHERE c.type = 62 AND c.models LIKE '%agnes-video-v2.0%'
  AND NOT EXISTS (
    SELECT 1 FROM abilities a
    WHERE a.channel_id = c.id AND a.model = 'agnes-video-v2.0' AND a."group" = c."group"
  );

UPDATE channels
SET models = TRIM(BOTH ',' FROM regexp_replace(
  regexp_replace(',' || models || ',', ',agnes-video-v2\.0,', ',', 'g'),
  '^,|,$', '', 'g'
))
WHERE id IN (26, 28) AND models LIKE '%agnes-video-v2.0%';

UPDATE abilities
SET enabled = false
WHERE model = 'agnes-video-v2.0' AND channel_id IN (26, 28);

COMMIT;

-- Verify:
-- SELECT id, name, type, status, models FROM channels WHERE type = 62 OR id IN (26, 28);
-- SELECT * FROM abilities WHERE model = 'agnes-video-v2.0';
