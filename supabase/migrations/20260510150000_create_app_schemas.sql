CREATE SCHEMA IF NOT EXISTS postalpeek;
CREATE SCHEMA IF NOT EXISTS potlink;

DO $$
DECLARE
    r RECORD;
    schema_name TEXT;
    new_table_name TEXT;
BEGIN
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND (tablename LIKE 'postalpeek_%' OR tablename LIKE 'potlink_%')
    ) LOOP
        -- Determine target schema and new name
        IF r.tablename LIKE 'postalpeek_%' THEN
            schema_name := 'postalpeek';
            new_table_name := substring(r.tablename from 12); -- length('postalpeek_') + 1
        ELSIF r.tablename LIKE 'potlink_%' THEN
            schema_name := 'potlink';
            new_table_name := substring(r.tablename from 9); -- length('potlink_') + 1
        END IF;

        -- Execute the move and rename
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' SET SCHEMA ' || quote_ident(schema_name);
        EXECUTE 'ALTER TABLE ' || quote_ident(schema_name) || '.' || quote_ident(r.tablename) || ' RENAME TO ' || quote_ident(new_table_name);
    END LOOP;
END $$;
