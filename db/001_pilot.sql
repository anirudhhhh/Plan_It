-- Pilot persistence. JSONB documents retain domain names; generated keys/indexes
-- enforce uniqueness. Only the server database role may access these tables.
-- All application writes are serialized under a transaction advisory lock.
BEGIN;
DO $$
DECLARE entity text;
BEGIN
 FOREACH entity IN ARRAY ARRAY['users','destinations','packs','pack_days','stays','room_types','ride_partners','ride_routes','price_items','cancellation_policies','trips','trip_members','trip_items','booking_requests','booking_status_history','expenses','expense_splits','settlements','leads','audit_log','events','rate_limits','notifications'] LOOP
  EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I (id uuid PRIMARY KEY, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK (data->>''id'' = id::text))',entity);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',entity);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',entity);
 END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS member_once ON trip_members ((data->>'trip_id'),(data->>'user_id'));
CREATE UNIQUE INDEX IF NOT EXISTS split_once ON expense_splits ((data->>'expense_id'),(data->>'user_id'));
CREATE UNIQUE INDEX IF NOT EXISTS unique_invite ON trips ((data->>'invite_token'));
CREATE INDEX IF NOT EXISTS trip_expenses ON expenses ((data->>'trip_id'));
CREATE INDEX IF NOT EXISTS user_bookings ON booking_requests ((data->>'user_id'));
CREATE INDEX IF NOT EXISTS current_prices ON price_items ((data->>'ref_id'),(data->>'valid_from'),(data->>'valid_to'));
CREATE INDEX IF NOT EXISTS user_notifications ON notifications ((data->>'user_id'),(data->>'created_at'));
CREATE UNIQUE INDEX IF NOT EXISTS trip_booking_once ON trip_items ((data->>'booking_request_id')) WHERE data ? 'booking_request_id';
COMMIT;
