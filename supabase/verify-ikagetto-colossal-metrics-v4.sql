-- Run after ikagetto-ranking-v1.sql, ikagetto-fishing-metrics-v2.sql,
-- ikagetto-board-pagination-v3.sql and ikagetto-colossal-metrics-v4.sql on an empty local database.
-- Note: verify-ikagetto-ranking-v1.sql and verify-ikagetto-fishing-metrics-v2.sql check the
-- older limits (50,000 points / 30 m), so they are expected to fail once this v4 is applied.
BEGIN;
SET LOCAL ROLE anon;

DO $$
DECLARE
  v_max uuid := '00000000-0000-4000-8000-000000000401';
  v_over uuid := '00000000-0000-4000-8000-000000000402';
  v_long uuid := '00000000-0000-4000-8000-000000000403';
  v_heavy uuid := '00000000-0000-4000-8000-000000000404';
  v_butcher uuid := '00000000-0000-4000-8000-000000000405';
  v_cooking uuid := '00000000-0000-4000-8000-000000000406';
  v_small uuid := '00000000-0000-4000-8000-000000000407';
  v_legacy uuid := '00000000-0000-4000-8000-000000000408';
  v_row record;
BEGIN
  -- A 50m / 45,000kg / 80,000-point catch is accepted and shown with its measurements.
  PERFORM public.ikagetto_start_v1(v_max, 'fishing', 'Leviathan');
  SELECT r.* INTO STRICT v_row FROM public.ikagetto_fishing_finish_v2(v_max, 80000, 50, 45000, 166000) AS r;
  IF v_row.rank IS DISTINCT FROM 1::bigint THEN
    RAISE EXCEPTION 'A maximum colossal catch must rank first: %', v_row;
  END IF;
  SELECT b.* INTO STRICT v_row FROM public.ikagetto_board_page_v3('fishing', 0, 10) AS b;
  IF (v_row.score, v_row.length_meters, v_row.weight_kg, v_row.elapsed_ms)
     IS DISTINCT FROM (80000, 50, 45000, 166000) THEN
    RAISE EXCEPTION 'The board must keep the colossal measurements: %', v_row;
  END IF;

  -- Over the new limits is still refused with 22023.
  PERFORM public.ikagetto_start_v1(v_over, 'fishing', 'Over');
  BEGIN
    PERFORM public.ikagetto_fishing_finish_v2(v_over, 80001, 50, 40000, 160000);
    RAISE EXCEPTION 'Scores above 80000 must be refused';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'ikagetto_invalid_finish' THEN RAISE; END IF;
  END;
  PERFORM public.ikagetto_start_v1(v_long, 'fishing', 'Long');
  BEGIN
    PERFORM public.ikagetto_fishing_finish_v2(v_long, 79000, 51, 40000, 160000);
    RAISE EXCEPTION 'Lengths above 50m must be refused';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'ikagetto_invalid_catch_metrics' THEN RAISE; END IF;
  END;
  PERFORM public.ikagetto_start_v1(v_heavy, 'fishing', 'Heavy');
  BEGIN
    PERFORM public.ikagetto_fishing_finish_v2(v_heavy, 79000, 50, 45001, 160000);
    RAISE EXCEPTION 'Weights above 45000kg must be refused';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'ikagetto_invalid_catch_metrics' THEN RAISE; END IF;
  END;

  -- Butchering and cooking keep the 50,000 limit and answer with 22023.
  PERFORM public.ikagetto_start_v1(v_butcher, 'butcher', 'Chef');
  BEGIN
    PERFORM public.ikagetto_finish_v1(v_butcher, 50001);
    RAISE EXCEPTION 'Butcher scores above 50000 must be refused';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'ikagetto_invalid_finish' THEN RAISE; END IF;
  END;
  PERFORM public.ikagetto_finish_v1(v_butcher, 50000);
  PERFORM public.ikagetto_start_v1(v_cooking, 'cooking', 'Chef');
  BEGIN
    PERFORM public.ikagetto_finish_v1(v_cooking, 60000);
    RAISE EXCEPTION 'Cooking scores above 50000 must be refused';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'ikagetto_invalid_finish' THEN RAISE; END IF;
  END;

  -- 1-30m catches and legacy (unmeasured) fishing scores still work as before.
  PERFORM public.ikagetto_start_v1(v_small, 'fishing', 'Small');
  PERFORM public.ikagetto_fishing_finish_v2(v_small, 42000, 16, 1600, 65321);
  PERFORM public.ikagetto_start_v1(v_legacy, 'fishing', 'Legacy');
  PERFORM public.ikagetto_finish_v1(v_legacy, 30000);
  IF (SELECT count(*) FROM public.ikagetto_board_page_v3('fishing', 0, 10)) <> 3 THEN
    RAISE EXCEPTION 'The fishing board must list the colossal, small and legacy scores';
  END IF;
END;
$$;

ROLLBACK;
