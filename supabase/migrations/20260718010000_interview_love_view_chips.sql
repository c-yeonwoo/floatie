-- S4 chips: weekend energy → dating-view values (app_config is text JSON).
UPDATE public.app_config
SET value = (
  COALESCE(value::jsonb, '{}'::jsonb)
  - 'weekend'
  || jsonb_build_object(
    'love_view',
    '["천천히 깊게","편하고 즐겁게","서로 성장","자주 연락하며","아직 모르겠어요"]'::jsonb
  )
)::text
WHERE key = 'interview_chips_v2';
