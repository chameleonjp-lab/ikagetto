-- Run after both ranking migrations on an empty local database.
BEGIN;
SET LOCAL ROLE anon;

DO $$
DECLARE
  v_first uuid := '00000000-0000-4000-8000-000000000101';
  v_lower uuid := '00000000-0000-4000-8000-000000000102';
  v_equal uuid := '00000000-0000-4000-8000-000000000103';
  v_best uuid := '00000000-0000-4000-8000-000000000104';
  v_tie uuid := '00000000-0000-4000-8000-000000000105';
  v_legacy uuid := '00000000-0000-4000-8000-000000000106';
  v_guest uuid := '00000000-0000-4000-8000-000000000107';
  v_butcher uuid := '00000000-0000-4000-8000-000000000108';
  v_fill uuid := '00000000-0000-4000-8000-000000000109';
  v_row record;
BEGIN
  PERFORM public.ikagetto_start_v1(v_first, 'fishing', 'Alice');
  PERFORM public.ikagetto_fishing_finish_v2(v_first, 42000, 16, 1600, 65321);
  PERFORM public.ikagetto_fishing_finish_v2(v_first, 42000, 16, 1600, 65321);

  BEGIN
    PERFORM public.ikagetto_fishing_finish_v2(v_first, 42000, 17, 1600, 65321);
    RAISE EXCEPTION 'A retry must retain the original measurements';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'ikagetto_finish_conflict' THEN RAISE; END IF;
  END;

  PERFORM public.ikagetto_start_v1(v_lower, 'fishing', 'alice');
  PERFORM public.ikagetto_fishing_finish_v2(v_lower, 40000, 19, 2200, 60200);
  PERFORM public.ikagetto_start_v1(v_equal, 'fishing', 'ALICE');
  PERFORM public.ikagetto_fishing_finish_v2(v_equal, 42000, 20, 2400, 58790);
  SELECT b.* INTO STRICT v_row FROM public.ikagetto_fishing_board_v2(30) AS b;
  IF (v_row.rank, v_row.display_name, v_row.score, v_row.length_meters, v_row.weight_kg, v_row.elapsed_ms)
     IS DISTINCT FROM (1::bigint, 'Alice'::text, 42000, 16, 1600, 65321) THEN
    RAISE EXCEPTION 'Lower or equal scores changed the recorded best: %', v_row;
  END IF;

  PERFORM public.ikagetto_start_v1(v_best, 'fishing', 'Alice');
  BEGIN
    PERFORM public.ikagetto_fishing_finish_v2(v_best, 48000, 31, 2500, 51200);
    RAISE EXCEPTION 'Impossible lengths must be rejected';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'ikagetto_invalid_catch_metrics' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.ikagetto_fishing_finish_v2(v_best, 48000, 24, NULL, 51200);
    RAISE EXCEPTION 'Partial measurements must be rejected';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'ikagetto_invalid_catch_metrics' THEN RAISE; END IF;
  END;
  PERFORM public.ikagetto_fishing_finish_v2(v_best, 48000, 24, 3100, 51200);
  PERFORM public.ikagetto_start_v1(v_tie, 'fishing', 'Bob');
  PERFORM public.ikagetto_fishing_finish_v2(v_tie, 48000, 25, 3400, 54000);
  SELECT b.* INTO STRICT v_row FROM public.ikagetto_fishing_board_v2(30) AS b WHERE b.display_name = 'Alice';
  IF (v_row.rank, v_row.score, v_row.length_meters, v_row.weight_kg, v_row.elapsed_ms)
     IS DISTINCT FROM (1::bigint, 48000, 24, 3100, 51200) THEN
    RAISE EXCEPTION 'The new best must carry only its own catch: %', v_row;
  END IF;
  SELECT b.* INTO STRICT v_row FROM public.ikagetto_fishing_board_v2(30) AS b WHERE b.display_name = 'Bob';
  IF (v_row.rank, v_row.length_meters, v_row.elapsed_ms) IS DISTINCT FROM (1::bigint, 25, 54000) THEN
    RAISE EXCEPTION 'Catch size and time must not break a score tie: %', v_row;
  END IF;

  PERFORM public.ikagetto_start_v1(v_legacy, 'fishing', 'Alice');
  PERFORM public.ikagetto_finish_v1(v_legacy, 49000);
  SELECT b.* INTO STRICT v_row FROM public.ikagetto_fishing_board_v2(30) AS b WHERE b.display_name = 'Alice';
  IF (v_row.score, v_row.length_meters, v_row.weight_kg, v_row.elapsed_ms)
     IS DISTINCT FROM (49000, NULL::integer, NULL::integer, NULL::integer) THEN
    RAISE EXCEPTION 'An older client must not borrow measurements from another catch: %', v_row;
  END IF;
  PERFORM public.ikagetto_start_v1(v_fill, 'fishing', 'Alice');
  PERFORM public.ikagetto_fishing_finish_v2(v_fill, 49000, 27, 4000, 50109);
  SELECT b.* INTO STRICT v_row FROM public.ikagetto_fishing_board_v2(30) AS b WHERE b.display_name = 'Alice';
  IF (v_row.score, v_row.length_meters, v_row.weight_kg, v_row.elapsed_ms)
     IS DISTINCT FROM (49000, 27, 4000, 50109) THEN
    RAISE EXCEPTION 'A measured run can supply the measurements of a tied legacy best: %', v_row;
  END IF;

  PERFORM public.ikagetto_start_v1(v_guest, 'fishing', NULL);
  SELECT r.* INTO STRICT v_row FROM public.ikagetto_fishing_finish_v2(v_guest, 50000, 30, 6000, 45500) AS r;
  IF v_row.rank IS NOT NULL OR (SELECT count(*) FROM public.ikagetto_fishing_board_v2(30)) <> 2 THEN
    RAISE EXCEPTION 'Guest catches must stay off the board';
  END IF;
  PERFORM public.ikagetto_start_v1(v_butcher, 'butcher', 'Alice');
  BEGIN
    PERFORM public.ikagetto_fishing_finish_v2(v_butcher, 10000, 25, 3400, 54000);
    RAISE EXCEPTION 'Other modes must reject catch measurements';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'ikagetto_invalid_catch_mode' THEN RAISE; END IF;
  END;
  PERFORM public.ikagetto_finish_v1(v_butcher, 10000);
  IF (SELECT score FROM public.ikagetto_board_v1('butcher', 1)) IS DISTINCT FROM 10000 THEN
    RAISE EXCEPTION 'The butcher board must still receive scores';
  END IF;
END;
$$;

ROLLBACK;
