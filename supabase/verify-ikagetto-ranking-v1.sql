-- ikagetto-ranking-v1.sql を適用済みの空の検証データベースで実行する。
-- すべて架空のデータで、検証の最後に取り消す。

BEGIN;
SET LOCAL ROLE anon;

DO $$
DECLARE
  v_guest uuid := '00000000-0000-4000-8000-000000000001';
  v_alice uuid := '00000000-0000-4000-8000-000000000002';
  v_bob uuid := '00000000-0000-4000-8000-000000000003';
  v_caro uuid := '00000000-0000-4000-8000-000000000004';
  v_alice_lower uuid := '00000000-0000-4000-8000-000000000005';
  v_alice_best uuid := '00000000-0000-4000-8000-000000000006';
  v_unfinished uuid := '00000000-0000-4000-8000-000000000007';
  v_alice_butcher uuid := '00000000-0000-4000-8000-000000000008';
  v_dana_butcher uuid := '00000000-0000-4000-8000-000000000009';
  v_guest_butcher uuid := '00000000-0000-4000-8000-000000000010';
  v_dana_cooking uuid := '00000000-0000-4000-8000-000000000011';
  v_ebi_cooking uuid := '00000000-0000-4000-8000-000000000012';
  v_result jsonb;
BEGIN
  SELECT pg_catalog.to_jsonb(s) INTO STRICT v_result FROM public.ikagetto_stats_v1() AS s;
  IF v_result IS DISTINCT FROM '{"total_play_count":0,"player_count":0,"fishing":0,"butcher":0,"cooking":0}'::jsonb THEN
    RAISE EXCEPTION 'Expected empty mode totals and no registered players: %', v_result;
  END IF;

  IF public.ikagetto_start_v1(v_guest, 'fishing', NULL) <> 'accepted' THEN
    RAISE EXCEPTION 'A guest run must be accepted';
  END IF;
  IF public.ikagetto_start_v1(v_guest, 'fishing', NULL) <> 'duplicate' THEN
    RAISE EXCEPTION 'A guest run must be counted once';
  END IF;
  SELECT pg_catalog.to_jsonb(r) INTO STRICT v_result FROM public.ikagetto_finish_v1(v_guest, 50000) AS r;
  IF v_result IS DISTINCT FROM '{"rank":null,"play_count":1}'::jsonb THEN
    RAISE EXCEPTION 'A guest result must show starts and no rank: %', v_result;
  END IF;
  IF EXISTS (SELECT FROM public.ikagetto_board_v1('fishing', 100)) THEN
    RAISE EXCEPTION 'A guest score must be omitted from the board';
  END IF;

  IF public.ikagetto_start_v1(v_alice, 'fishing', '　Ａlice　') <> 'accepted' THEN
    RAISE EXCEPTION 'A valid named run must be accepted';
  END IF;
  IF public.ikagetto_start_v1(v_alice, 'fishing', 'alice') <> 'duplicate' THEN
    RAISE EXCEPTION 'Equivalent Unicode names must identify the same run';
  END IF;
  PERFORM public.ikagetto_start_v1(v_bob, 'fishing', 'Bob');
  PERFORM public.ikagetto_start_v1(v_caro, 'fishing', 'Caro');
  PERFORM public.ikagetto_finish_v1(v_alice, 220);
  SELECT pg_catalog.to_jsonb(r) INTO STRICT v_result FROM public.ikagetto_finish_v1(v_bob, 220) AS r;
  IF v_result IS DISTINCT FROM '{"rank":1,"play_count":4}'::jsonb THEN
    RAISE EXCEPTION 'A tie must share the same rank: %', v_result;
  END IF;
  SELECT pg_catalog.to_jsonb(r) INTO STRICT v_result FROM public.ikagetto_finish_v1(v_caro, 150) AS r;
  IF v_result IS DISTINCT FROM '{"rank":3,"play_count":4}'::jsonb THEN
    RAISE EXCEPTION 'The next score must skip a place after a tie: %', v_result;
  END IF;
  SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(b)) INTO v_result
    FROM public.ikagetto_board_v1('fishing', 100) AS b;
  IF v_result IS DISTINCT FROM '[{"rank":1,"display_name":"Ａlice","score":220},
    {"rank":1,"display_name":"Bob","score":220},{"rank":3,"display_name":"Caro","score":150}]'::jsonb THEN
    RAISE EXCEPTION 'Fishing board order, result fields or tie ranks are incorrect: %', v_result;
  END IF;

  PERFORM public.ikagetto_start_v1(v_alice_lower, 'fishing', 'alice');
  SELECT pg_catalog.to_jsonb(r) INTO STRICT v_result FROM public.ikagetto_finish_v1(v_alice_lower, 130) AS r;
  IF v_result IS DISTINCT FROM '{"rank":4,"play_count":5}'::jsonb THEN
    RAISE EXCEPTION 'The current result must be ranked against all existing best scores: %', v_result;
  END IF;
  SELECT pg_catalog.to_jsonb(r) INTO STRICT v_result FROM public.ikagetto_finish_v1(v_alice_lower, 130) AS r;
  IF v_result IS DISTINCT FROM '{"rank":4,"play_count":5}'::jsonb THEN
    RAISE EXCEPTION 'The same finish must be safe to retry: %', v_result;
  END IF;
  IF (SELECT score FROM public.ikagetto_board_v1('fishing', 1)) IS DISTINCT FROM 220 THEN
    RAISE EXCEPTION 'A lower score must preserve the personal best';
  END IF;
  PERFORM public.ikagetto_start_v1(v_alice_best, 'fishing', 'ALICE');
  PERFORM public.ikagetto_finish_v1(v_alice_best, 350);
  SELECT pg_catalog.to_jsonb(b) INTO STRICT v_result FROM public.ikagetto_board_v1('fishing', 1) AS b;
  IF v_result IS DISTINCT FROM '{"rank":1,"display_name":"ALICE","score":350}'::jsonb THEN
    RAISE EXCEPTION 'A greater score must replace that mode’s personal best: %', v_result;
  END IF;
  PERFORM public.ikagetto_start_v1(v_unfinished, 'fishing', 'Unfinished');

  PERFORM public.ikagetto_start_v1(v_alice_butcher, 'butcher', 'Alice');
  SELECT pg_catalog.to_jsonb(r) INTO STRICT v_result FROM public.ikagetto_finish_v1(v_alice_butcher, 0) AS r;
  IF v_result IS DISTINCT FROM '{"rank":1,"play_count":1}'::jsonb THEN
    RAISE EXCEPTION 'A valid zero score must enter its own board: %', v_result;
  END IF;
  PERFORM public.ikagetto_start_v1(v_dana_butcher, 'butcher', 'Dana');
  PERFORM public.ikagetto_finish_v1(v_dana_butcher, 100);
  PERFORM public.ikagetto_start_v1(v_guest_butcher, 'butcher', NULL);
  PERFORM public.ikagetto_start_v1(v_dana_cooking, 'cooking', 'ＤＡＮＡ');
  PERFORM public.ikagetto_finish_v1(v_dana_cooking, 50000);
  PERFORM public.ikagetto_start_v1(v_ebi_cooking, 'cooking', 'えび');
  PERFORM public.ikagetto_finish_v1(v_ebi_cooking, 50000);

  SELECT pg_catalog.to_jsonb(s) INTO STRICT v_result FROM public.ikagetto_stats_v1() AS s;
  IF v_result IS DISTINCT FROM '{"total_play_count":7,"player_count":5,"fishing":7,"butcher":3,"cooking":2}'::jsonb THEN
    RAISE EXCEPTION 'Expected distinct started runs per mode and distinct finished names overall: %', v_result;
  END IF;
  IF (SELECT pg_catalog.count(*) FROM public.ikagetto_board_v1('fishing', 100)) <> 3
     OR (SELECT score FROM public.ikagetto_board_v1('butcher', 1)) IS DISTINCT FROM 100
     OR (SELECT pg_catalog.count(*) FROM public.ikagetto_board_v1('cooking', 100) WHERE rank = 1) <> 2 THEN
    RAISE EXCEPTION 'The boards must be independent across all modes';
  END IF;

  BEGIN
    PERFORM public.ikagetto_start_v1(v_guest, 'butcher', NULL);
    RAISE EXCEPTION 'A run ID must be bound to its mode';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    IF SQLERRM <> 'ikagetto_start_conflict' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.ikagetto_start_v1(v_alice, 'fishing', NULL);
    RAISE EXCEPTION 'A run ID must be bound to its original registration';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    IF SQLERRM <> 'ikagetto_start_conflict' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.ikagetto_finish_v1(v_alice_lower, 50000);
    RAISE EXCEPTION 'A completed score must be immutable';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    IF SQLERRM <> 'ikagetto_finish_conflict' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.ikagetto_finish_v1(pg_catalog.gen_random_uuid(), 123);
    RAISE EXCEPTION 'A finish must match a previous start';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    IF SQLERRM <> 'ikagetto_unknown_run' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.ikagetto_finish_v1(v_unfinished, 50001);
    RAISE EXCEPTION 'Scores outside the allowed range must be rejected';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    IF SQLERRM <> 'ikagetto_invalid_finish' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.ikagetto_start_v1(pg_catalog.gen_random_uuid(), 'fishing', '　 ');
    RAISE EXCEPTION 'White space cannot be used as a name';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    IF SQLERRM <> 'ikagetto_invalid_name' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.ikagetto_start_v1(pg_catalog.gen_random_uuid(), 'other', NULL);
    RAISE EXCEPTION 'Unknown modes must be rejected';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    IF SQLERRM <> 'ikagetto_invalid_start' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.ikagetto_board_v1('fishing', 101);
    RAISE EXCEPTION 'A board page must be limited to 100 rows';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    IF SQLERRM <> 'ikagetto_invalid_board' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM r.run_id FROM ikagetto_ranking_private.runs AS r;
    RAISE EXCEPTION 'The public API role must be denied direct access to run IDs';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM ikagetto_ranking_private.stats();
    RAISE EXCEPTION 'The public API role must call the public wrapper';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;

RESET ROLE;
UPDATE ikagetto_ranking_private.modes
  SET starts_in_minute = 600, rate_minute = pg_catalog.clock_timestamp() + interval '1 minute'
  WHERE mode = 'fishing';

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_run uuid := '00000000-0000-4000-8000-000000000013';
BEGIN
  IF public.ikagetto_start_v1('00000000-0000-4000-8000-000000000001', 'fishing', NULL) <> 'duplicate' THEN
    RAISE EXCEPTION 'Retries must work even when the mode is at capacity';
  END IF;
  BEGIN
    PERFORM public.ikagetto_start_v1(v_run, 'fishing', NULL);
    RAISE EXCEPTION 'A capped mode must reject new runs';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'ikagetto_start_limit' THEN RAISE; END IF;
  END;
  IF public.ikagetto_start_v1(v_run, 'cooking', NULL) <> 'accepted' THEN
    RAISE EXCEPTION 'A rejected start must not reserve its ID or limit a different mode';
  END IF;
  IF (SELECT total_play_count FROM public.ikagetto_stats_v1()) <> 7 THEN
    RAISE EXCEPTION 'Neither duplicate nor rejected starts should change the fishing count';
  END IF;
END;
$$;

SET LOCAL ROLE service_role;
DO $$
BEGIN
  PERFORM public.ikagetto_stats_v1();
  RAISE EXCEPTION 'The explicitly excluded service role must be denied the public ranking API';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END;
$$;

ROLLBACK;
