-- Run in the isolated ranking test database after ikagetto-hall-of-fame-v1.sql.
BEGIN;
SET LOCAL ROLE anon;

DO $$
DECLARE
  row_found record;
BEGIN
  IF EXISTS (SELECT 1 FROM public.ikagetto_hall_of_fame_v1(0, 10)) THEN
    RAISE EXCEPTION 'An empty hall must return zero rows';
  END IF;

  PERFORM public.ikagetto_start_v1('00000000-0000-4000-8000-000000000501', 'fishing', 'First Fisher');
  PERFORM public.ikagetto_fishing_finish_v2('00000000-0000-4000-8000-000000000501', 60000, 50, 31000, 175000);
  PERFORM public.ikagetto_start_v1('00000000-0000-4000-8000-000000000502', 'fishing', 'Second Fisher');
  PERFORM public.ikagetto_fishing_finish_v2('00000000-0000-4000-8000-000000000502', 79900, 50, 44000, 170000);
  PERFORM public.ikagetto_start_v1('00000000-0000-4000-8000-000000000503', 'fishing', 'first fisher');
  PERFORM public.ikagetto_fishing_finish_v2('00000000-0000-4000-8000-000000000503', 75000, 50, 41000, 158000);
  PERFORM public.ikagetto_start_v1('00000000-0000-4000-8000-000000000504', 'fishing', 'First Fisher');
  PERFORM public.ikagetto_fishing_finish_v2('00000000-0000-4000-8000-000000000504', 80000, 49, 38000, 140000);
  PERFORM public.ikagetto_start_v1('00000000-0000-4000-8000-000000000505', 'fishing', null);
  PERFORM public.ikagetto_fishing_finish_v2('00000000-0000-4000-8000-000000000505', 80000, 50, 45000, 120000);
  PERFORM public.ikagetto_start_v1('00000000-0000-4000-8000-000000000506', 'fishing', 'Legacy Fisher');
  PERFORM public.ikagetto_finish_v1('00000000-0000-4000-8000-000000000506', 80000);

  SELECT * INTO STRICT row_found FROM public.ikagetto_hall_of_fame_v1(0, 1);
  IF (row_found.rank, row_found.display_name, row_found.score, row_found.length_meters,
      row_found.weight_kg, row_found.elapsed_ms, row_found.has_more)
      IS DISTINCT FROM (1::bigint, 'first fisher'::text, 75000, 50, 41000, 158000, true) THEN
    RAISE EXCEPTION 'First entry must keep its number and show its best eligible catch: %', row_found;
  END IF;
  SELECT * INTO STRICT row_found FROM public.ikagetto_hall_of_fame_v1(1, 1);
  IF (row_found.rank, row_found.display_name, row_found.score, row_found.has_more)
      IS DISTINCT FROM (2::bigint, 'Second Fisher'::text, 79900, false) THEN
    RAISE EXCEPTION 'Second entry must keep its number despite a higher score: %', row_found;
  END IF;
  IF EXISTS (SELECT 1 FROM public.ikagetto_hall_of_fame_v1(2, 500)) THEN
    RAISE EXCEPTION 'Anonymous, 49m and unmeasured catches must not enter the hall';
  END IF;
  IF (SELECT count(*) FROM public.ikagetto_board_page_v3('fishing', 0, 10)) <> 3 THEN
    RAISE EXCEPTION 'Existing fishing records must remain in the regular leaderboard';
  END IF;
  IF pg_catalog.has_schema_privilege('ikagetto_ranking_private', 'USAGE') THEN
    RAISE EXCEPTION 'Private schema must remain inaccessible to anon';
  END IF;
  BEGIN
    PERFORM public.ikagetto_hall_of_fame_v1(0, 501);
    RAISE EXCEPTION 'Page sizes must be limited to 500';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'ikagetto_invalid_hall_page' THEN RAISE; END IF;
  END;
END;
$$;

ROLLBACK;
