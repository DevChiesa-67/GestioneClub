-- STEP 1: Diagnostica — elenca tutte le policy e le view che dipendono
-- dalla colonna tipo_profilo (o dal tipo tipo_profilo_enum), così da
-- poterle droppare/ricreare in modo sicuro prima di alterare la colonna.

-- Policy RLS che referenziano tipo_profilo in USING o WITH CHECK
SELECT
  'policy' AS kind,
  schemaname,
  tablename,
  policyname AS name,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE qual ILIKE '%tipo_profilo%'
   OR with_check ILIKE '%tipo_profilo%'
ORDER BY tablename, policyname;

-- View che referenziano tipo_profilo
SELECT
  'view' AS kind,
  schemaname,
  viewname AS name,
  definition
FROM pg_views
WHERE definition ILIKE '%tipo_profilo%';

-- Tutte le colonne nel database che usano il tipo tipo_profilo_enum
-- (potrebbero essercene altre oltre a profili.tipo_profilo)
SELECT
  c.table_schema,
  c.table_name,
  c.column_name,
  c.udt_name
FROM information_schema.columns c
WHERE c.udt_name = 'tipo_profilo_enum';

-- I valori attuali dell'enum, per popolare correttamente tipi_profili
SELECT enumlabel
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'tipo_profilo_enum'
ORDER BY e.enumsortorder;
