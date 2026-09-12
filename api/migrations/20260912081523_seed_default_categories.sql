-- Hand-written: the ten global default categories, copied from the Python
-- database with their ids intact. A NULL user_id is what makes a row global —
-- it is listed for every user and deletable by none.
--
-- The ids are preserved rather than regenerated because transactions reference
-- them, so a renumbering here would have to be matched by a rewrite of every
-- category_id in the transactions backfill.
INSERT INTO "categories" ("id", "name", "icon", "hex_color", "user_id", "created_at") VALUES
  ( 1, 'food',           'icon-tools-kitchen-2',   '#00A36C', NULL, '2025-07-27 00:00:00+00'),
  ( 2, 'transportation', 'icon-car',               '#000080', NULL, '2025-07-27 00:00:00+00'),
  ( 3, 'entertainment',  'icon-building-carousel', '#e0b0ff', NULL, '2025-07-27 00:00:00+00'),
  ( 4, 'education',      'icon-school',            '#B2BEB5', NULL, '2025-07-27 00:00:00+00'),
  ( 5, 'health',         'icon-stethoscope',       '#FF7518', NULL, '2025-07-27 00:00:00+00'),
  ( 6, 'house',          'icon-home',              '#B87333', NULL, '2025-07-27 00:00:00+00'),
  ( 7, 'savings',        'icon-tip-jar',           '#5D3FD3', NULL, '2025-07-27 00:00:00+00'),
  ( 8, 'charity',        'icon-heart-handshake',   '#E9DCC9', NULL, '2025-07-27 00:00:00+00'),
  ( 9, 'clothing',       'icon-shirt',             '#89CFF0', NULL, '2025-07-27 00:00:00+00'),
  (10, 'other',          'icon-dots',              '#252525', NULL, '2025-07-27 00:00:00+00')
ON CONFLICT ("id") DO NOTHING;

-- Reserve 1..11, not 1..10. Id 11 is the one user-owned category still in the
-- Python database; leaving it unreserved would let the first category created
-- through the Go API take that id and collide when the rest is backfilled.
SELECT setval('categories_id_seq', 11, true);
