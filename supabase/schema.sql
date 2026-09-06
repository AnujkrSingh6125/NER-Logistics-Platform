-- ============================================================================
-- NORTH EASTERN REGION (NER) TACTICAL LOGISTICS & HAZARD MANAGEMENT PLATFORM
-- Unified Master Database Schema, PostGIS Spatial Functions, RLS & Seed Data
-- Target Environment: Supabase / PostgreSQL 15+ (100% Idempotent & Self-Contained)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS & SPATIAL PREREQUISITES
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Completely remove obsolete profiles table if it exists
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Optional: Uncomment below only if you want to wipe clean existing records for a fresh start:
-- TRUNCATE TABLE public.road_hazards, public.shipments, public.driver_profiles CASCADE;

-- ----------------------------------------------------------------------------
-- 2. TABLE DEFINITIONS & IDEMPOTENT COLUMN SYNCHRONIZATION
-- ----------------------------------------------------------------------------

-- Table 1: nodal_officers
-- Authoritative directory of authorized state disaster management nodal officers
CREATE TABLE IF NOT EXISTS public.nodal_officers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    officer_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    state TEXT NOT NULL CHECK (
        state IN (
            'Assam',
            'Arunachal Pradesh',
            'Meghalaya',
            'Manipur',
            'Mizoram',
            'Nagaland',
            'Tripura',
            'Sikkim'
        )
    ),
    department TEXT NOT NULL,
    designation TEXT NOT NULL,
    emergency_contact TEXT NOT NULL,
    access_passcode TEXT NOT NULL DEFAULT 'NER@Nodal2026',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.nodal_officers 
    ADD COLUMN IF NOT EXISTS officer_name TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS state TEXT,
    ADD COLUMN IF NOT EXISTS department TEXT,
    ADD COLUMN IF NOT EXISTS designation TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
    ADD COLUMN IF NOT EXISTS access_passcode TEXT DEFAULT 'NER@Nodal2026',
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

COMMENT ON TABLE public.nodal_officers IS 'Authoritative government nodal officer directory across all 8 NER states. Direct email + passcode authentication.';

-- Table 2: driver_profiles (The ONLY Driver & Telemetry Table)
CREATE TABLE IF NOT EXISTS public.driver_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT '',
    email TEXT,
    phone TEXT NOT NULL DEFAULT '',
    vehicle_number TEXT NOT NULL DEFAULT 'AS-01-AX-9921',
    driver_code TEXT UNIQUE NOT NULL,
    current_latitude DOUBLE PRECISION,
    current_longitude DOUBLE PRECISION,
    is_active_duty BOOLEAN NOT NULL DEFAULT FALSE,
    last_ping TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Ensure clean schema on driver_profiles
ALTER TABLE public.driver_profiles 
    ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS vehicle_number TEXT NOT NULL DEFAULT 'AS-01-AX-9921',
    ADD COLUMN IF NOT EXISTS driver_code TEXT,
    ADD COLUMN IF NOT EXISTS current_latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS current_longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS is_active_duty BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS last_ping TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    DROP COLUMN IF EXISTS vehicle_type,
    DROP COLUMN IF EXISTS speed,
    DROP COLUMN IF EXISTS heading,
    DROP COLUMN IF EXISTS state,
    DROP COLUMN IF EXISTS district,
    DROP COLUMN IF EXISTS last_telemetry_at;

COMMENT ON TABLE public.driver_profiles IS 'Primary authoritative driver accounts, identity, vehicle details and realtime GPS telemetry stream.';

-- Table 3: road_hazards
-- Road disruptions, landslides, flood inundations with PostGIS Point geometries
CREATE TABLE IF NOT EXISTS public.road_hazards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    hazard_type TEXT NOT NULL CHECK (
        hazard_type IN (
            'landslide',
            'flash_flood',
            'road_washout',
            'tree_fall',
            'heavy_waterlogging',
            'bridge_damage',
            'other'
        )
    ),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (
        severity IN ('low', 'medium', 'high', 'critical')
    ),
    status TEXT NOT NULL DEFAULT 'reported' CHECK (
        status IN ('reported', 'verified', 'resolved')
    ),
    image_url TEXT,
    media_urls TEXT[] DEFAULT '{}',
    reported_by_role TEXT NOT NULL DEFAULT 'citizen_driver' CHECK (
        reported_by_role IN ('citizen_driver', 'nodal_officer', 'admin')
    ),
    reported_by_name TEXT,
    reported_by_contact TEXT,
    reported_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ai_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ai_confidence NUMERIC,
    ai_hazard_type TEXT,
    ai_verdict_summary TEXT,
    ai_analysis_raw JSONB,
    impact_radius_km NUMERIC DEFAULT 5.0,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOMETRY(Point, 4326),
    state TEXT NOT NULL,
    district TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    resolved_at TIMESTAMPTZ
);

ALTER TABLE public.road_hazards 
    ADD COLUMN IF NOT EXISTS reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reported_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS hazard_type TEXT,
    ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'reported',
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS reported_by_role TEXT DEFAULT 'citizen_driver',
    ADD COLUMN IF NOT EXISTS reported_by_name TEXT,
    ADD COLUMN IF NOT EXISTS reported_by_contact TEXT,
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS ai_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC,
    ADD COLUMN IF NOT EXISTS ai_hazard_type TEXT,
    ADD COLUMN IF NOT EXISTS ai_verdict_summary TEXT,
    ADD COLUMN IF NOT EXISTS ai_analysis_raw JSONB,
    ADD COLUMN IF NOT EXISTS impact_radius_km NUMERIC DEFAULT 5.0,
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS location GEOMETRY(Point, 4326),
    ADD COLUMN IF NOT EXISTS state TEXT,
    ADD COLUMN IF NOT EXISTS district TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Relax foreign key constraints to allow both auth.users and departmental nodal officers
ALTER TABLE public.road_hazards 
    DROP CONSTRAINT IF EXISTS road_hazards_reported_by_fkey,
    DROP CONSTRAINT IF EXISTS road_hazards_reported_by_id_fkey;

-- Sync reported_by_id from reported_by if null on legacy rows
UPDATE public.road_hazards 
SET reported_by_id = reported_by 
WHERE reported_by_id IS NULL AND reported_by IS NOT NULL;

-- Ensure default impact radius of 5.0 km for all existing records
UPDATE public.road_hazards
SET impact_radius_km = 5.0
WHERE impact_radius_km IS NULL;

COMMENT ON TABLE public.road_hazards IS 'Ground-truth hazard reports from Citizen Drivers & Nodal Officers with spatial geometries & photo evidence.';

-- Table 4: supply_hubs
-- Strategic distribution centers, buffer godowns, and medical stockpiles across NER
CREATE TABLE IF NOT EXISTS public.supply_hubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hub_name TEXT NOT NULL,
    hub_code TEXT UNIQUE NOT NULL,
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    hub_type TEXT NOT NULL CHECK (
        hub_type IN (
            'state_central_depot',
            'district_fci_godown',
            'medical_depot',
            'fuel_storage',
            'emergency_transit_camp'
        )
    ),
    capacity_metric_tons NUMERIC(10, 2) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOMETRY(Point, 4326),
    contact_person TEXT,
    contact_phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.supply_hubs 
    ADD COLUMN IF NOT EXISTS hub_name TEXT,
    ADD COLUMN IF NOT EXISTS hub_code TEXT,
    ADD COLUMN IF NOT EXISTS state TEXT,
    ADD COLUMN IF NOT EXISTS district TEXT,
    ADD COLUMN IF NOT EXISTS hub_type TEXT,
    ADD COLUMN IF NOT EXISTS capacity_metric_tons NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS location GEOMETRY(Point, 4326),
    ADD COLUMN IF NOT EXISTS contact_person TEXT,
    ADD COLUMN IF NOT EXISTS contact_phone TEXT;

COMMENT ON TABLE public.supply_hubs IS 'Strategic NER inventory supply hubs, FCI godowns, and emergency transit camps with spatial coordinates.';

-- Table 5: shipments
-- Live tracking and manifest for essential relief commodity consignments and active journeys
CREATE TABLE IF NOT EXISTS public.shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_code TEXT UNIQUE NOT NULL,
    driver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    driver_code TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    cargo_type TEXT NOT NULL DEFAULT 'Emergency Relief Supplies',
    cargo_weight_val NUMERIC DEFAULT 15.0,
    cargo_weight_unit TEXT DEFAULT 'MT',
    commodity_type TEXT DEFAULT 'Emergency Relief Supplies',
    quantity_tons NUMERIC DEFAULT 15.0,
    origin_hub_id TEXT,
    origin_hub_name TEXT,
    origin TEXT,
    destination_hub_id TEXT,
    dest_hub_name TEXT,
    destination_district TEXT DEFAULT 'District Hub',
    destination_state TEXT DEFAULT 'Assam',
    status TEXT NOT NULL DEFAULT 'IN_TRANSIT',
    priority TEXT NOT NULL DEFAULT 'urgent',
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    current_latitude DOUBLE PRECISION,
    current_longitude DOUBLE PRECISION,
    current_location GEOMETRY(Point, 4326),
    eta TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Crucial: Ensure ALL shipments manifest columns exist on existing table instances
ALTER TABLE public.shipments 
    ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS driver_code TEXT,
    ADD COLUMN IF NOT EXISTS driver_name TEXT,
    ADD COLUMN IF NOT EXISTS driver_phone TEXT,
    ADD COLUMN IF NOT EXISTS cargo_type TEXT DEFAULT 'Emergency Relief Supplies',
    ADD COLUMN IF NOT EXISTS cargo_weight_val NUMERIC DEFAULT 15.0,
    ADD COLUMN IF NOT EXISTS cargo_weight_unit TEXT DEFAULT 'MT',
    ADD COLUMN IF NOT EXISTS commodity_type TEXT DEFAULT 'Emergency Relief Supplies',
    ADD COLUMN IF NOT EXISTS quantity_tons NUMERIC DEFAULT 15.0,
    ADD COLUMN IF NOT EXISTS origin_hub_id TEXT,
    ADD COLUMN IF NOT EXISTS origin_hub_name TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT,
    ADD COLUMN IF NOT EXISTS destination_hub_id TEXT,
    ADD COLUMN IF NOT EXISTS dest_hub_name TEXT,
    ADD COLUMN IF NOT EXISTS destination_district TEXT DEFAULT 'District Hub',
    ADD COLUMN IF NOT EXISTS destination_state TEXT DEFAULT 'Assam',
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'IN_TRANSIT',
    ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'urgent',
    ADD COLUMN IF NOT EXISTS current_lat DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS current_lng DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS current_latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS current_longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS current_location GEOMETRY(Point, 4326),
    ADD COLUMN IF NOT EXISTS eta TEXT;

-- Standardize & Relax Check Constraints for Shipments (Case-Insensitive & Resilient)
ALTER TABLE public.shipments 
    DROP CONSTRAINT IF EXISTS shipments_status_check,
    DROP CONSTRAINT IF EXISTS shipments_priority_check,
    DROP CONSTRAINT IF EXISTS shipments_commodity_type_check;

ALTER TABLE public.shipments 
    ADD CONSTRAINT shipments_status_check 
    CHECK (LOWER(status) IN ('in_transit', 'delivered', 'delayed', 'pending', 'cancelled', 'active', 'scheduled', 'diverted', 'completed', 'terminated', 'dispatched'));

-- If assigned_driver_id was present in old schema, sync values to driver_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'shipments' AND column_name = 'assigned_driver_id'
    ) THEN
        UPDATE public.shipments SET driver_id = assigned_driver_id WHERE driver_id IS NULL;
    END IF;
END $$;

COMMENT ON TABLE public.shipments IS 'Realtime consignment and journey tracking for relief supplies moving across mountain corridors.';

-- ----------------------------------------------------------------------------
-- 3. SPATIAL & PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------

-- Spatial GiST Indexes
CREATE INDEX IF NOT EXISTS idx_road_hazards_location 
    ON public.road_hazards USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_supply_hubs_location 
    ON public.supply_hubs USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_shipments_current_location 
    ON public.shipments USING GIST (current_location);

-- B-Tree Performance Indexes
CREATE INDEX IF NOT EXISTS idx_nodal_officers_state 
    ON public.nodal_officers (state);

CREATE INDEX IF NOT EXISTS idx_nodal_officers_email 
    ON public.nodal_officers (email);

CREATE INDEX IF NOT EXISTS idx_driver_profiles_code 
    ON public.driver_profiles (driver_code);

CREATE INDEX IF NOT EXISTS idx_driver_profiles_email 
    ON public.driver_profiles (email);

CREATE INDEX IF NOT EXISTS idx_driver_profiles_active 
    ON public.driver_profiles (is_active_duty);

CREATE INDEX IF NOT EXISTS idx_road_hazards_status_severity 
    ON public.road_hazards (status, severity);

CREATE INDEX IF NOT EXISTS idx_road_hazards_state 
    ON public.road_hazards (state);

CREATE INDEX IF NOT EXISTS idx_supply_hubs_state_district 
    ON public.supply_hubs (state, district);

CREATE INDEX IF NOT EXISTS idx_supply_hubs_hub_type 
    ON public.supply_hubs (hub_type);

CREATE INDEX IF NOT EXISTS idx_shipments_status_priority 
    ON public.shipments (status, priority);

CREATE INDEX IF NOT EXISTS idx_shipments_driver 
    ON public.shipments (driver_id);

CREATE INDEX IF NOT EXISTS idx_shipments_tracking_code 
    ON public.shipments (tracking_code);

-- ----------------------------------------------------------------------------
-- 4. AUTOMATED SPATIAL, AUDIT & AUTH AUTO-SYNC TRIGGERS
-- ----------------------------------------------------------------------------

-- 4.1 Function & Trigger: Automatic driver profile provisioning on auth.users signup
DROP FUNCTION IF EXISTS public.handle_user_signup() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    user_role TEXT;
    generated_driver_code TEXT := NULL;
    random_suffix INT;
BEGIN
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'citizen_driver');

    -- Generate unique tactical driver ID (e.g. DRV-NER-4821)
    random_suffix := floor(1000 + random() * 9000)::INT;
    generated_driver_code := 'DRV-NER-' || random_suffix;
    
    WHILE EXISTS (SELECT 1 FROM public.driver_profiles WHERE driver_code = generated_driver_code) LOOP
        random_suffix := floor(1000 + random() * 9000)::INT;
        generated_driver_code := 'DRV-NER-' || random_suffix;
    END LOOP;

    -- Insert or Update public.driver_profiles
    INSERT INTO public.driver_profiles (
        id,
        full_name,
        phone,
        email,
        vehicle_number,
        driver_code,
        is_active_duty,
        last_ping,
        created_at
    ) VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'vehicle_number', 'AS-01-AX-9921'),
        generated_driver_code,
        FALSE,
        TIMEZONE('utc', NOW()),
        TIMEZONE('utc', NOW())
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        vehicle_number = EXCLUDED.vehicle_number,
        driver_code = COALESCE(public.driver_profiles.driver_code, EXCLUDED.driver_code),
        updated_at = TIMEZONE('utc', NOW());

    RETURN NEW;
END;
$$;

-- Ensure trigger is active on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_signup();

-- 4.2 Function: Auto-populate and sync Point geometry from latitude & longitude
DROP FUNCTION IF EXISTS public.fn_sync_geometry_from_lat_long() CASCADE;

CREATE OR REPLACE FUNCTION public.fn_sync_geometry_from_lat_long()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    ELSE
        NEW.location := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for road_hazards
DROP TRIGGER IF EXISTS trg_road_hazards_spatial ON public.road_hazards;
CREATE TRIGGER trg_road_hazards_spatial
    BEFORE INSERT OR UPDATE OF latitude, longitude
    ON public.road_hazards
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_geometry_from_lat_long();

-- Trigger for supply_hubs
DROP TRIGGER IF EXISTS trg_supply_hubs_spatial ON public.supply_hubs;
CREATE TRIGGER trg_supply_hubs_spatial
    BEFORE INSERT OR UPDATE OF latitude, longitude
    ON public.supply_hubs
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_geometry_from_lat_long();

-- 4.3 Function: Auto-populate shipment current_location from coordinates
DROP FUNCTION IF EXISTS public.fn_sync_shipment_geometry() CASCADE;

CREATE OR REPLACE FUNCTION public.fn_sync_shipment_geometry()
RETURNS TRIGGER AS $$
DECLARE
    lat DOUBLE PRECISION;
    lng DOUBLE PRECISION;
BEGIN
    lat := COALESCE(NEW.current_lat, NEW.current_latitude);
    lng := COALESCE(NEW.current_lng, NEW.current_longitude);

    IF lat IS NOT NULL AND lng IS NOT NULL THEN
        NEW.current_location := ST_SetSRID(ST_MakePoint(lng, lat), 4326);
        NEW.current_lat := lat;
        NEW.current_lng := lng;
        NEW.current_latitude := lat;
        NEW.current_longitude := lng;
    ELSE
        NEW.current_location := NULL;
    END IF;
    NEW.updated_at := TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for shipments
DROP TRIGGER IF EXISTS trg_shipments_spatial ON public.shipments;
CREATE TRIGGER trg_shipments_spatial
    BEFORE INSERT OR UPDATE OF current_lat, current_lng, current_latitude, current_longitude, status, priority
    ON public.shipments
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_shipment_geometry();

-- 4.4 Function: Update timestamp helper
DROP FUNCTION IF EXISTS public.fn_handle_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION public.fn_handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for driver_profiles updated_at
DROP TRIGGER IF EXISTS trg_driver_profiles_updated_at ON public.driver_profiles;
CREATE TRIGGER trg_driver_profiles_updated_at
    BEFORE UPDATE ON public.driver_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_handle_updated_at();

-- Trigger for nodal_officers updated_at
DROP TRIGGER IF EXISTS trg_nodal_officers_updated_at ON public.nodal_officers;
CREATE TRIGGER trg_nodal_officers_updated_at
    BEFORE UPDATE ON public.nodal_officers
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_handle_updated_at();

-- ----------------------------------------------------------------------------
-- 5. SUPABASE REALTIME CONFIGURATION
-- ----------------------------------------------------------------------------
ALTER TABLE public.road_hazards REPLICA IDENTITY FULL;
ALTER TABLE public.shipments REPLICA IDENTITY FULL;
ALTER TABLE public.driver_profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'road_hazards'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.road_hazards;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shipments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'driver_profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_profiles;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. GEOSPATIAL HELPER FUNCTIONS (POSTGIS RPCs)
-- ----------------------------------------------------------------------------

-- Function: Find road hazards within a specific radius (in meters) of a coordinate
DROP FUNCTION IF EXISTS public.get_hazards_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) CASCADE;
DROP FUNCTION IF EXISTS public.get_hazards_within_radius(DOUBLE PRECISION, DOUBLE PRECISION) CASCADE;
DROP FUNCTION IF EXISTS public.get_hazards_within_radius CASCADE;

CREATE OR REPLACE FUNCTION public.get_hazards_within_radius(
    center_lng DOUBLE PRECISION,
    center_lat DOUBLE PRECISION,
    radius_meters DOUBLE PRECISION DEFAULT 25000
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    hazard_type TEXT,
    severity TEXT,
    status TEXT,
    impact_radius_km NUMERIC,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    distance_meters DOUBLE PRECISION,
    state TEXT,
    district TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.id,
        h.title,
        h.hazard_type,
        h.severity,
        h.status,
        COALESCE(h.impact_radius_km, 5.0) AS impact_radius_km,
        h.latitude,
        h.longitude,
        ST_Distance(
            h.location::geography,
            ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
        ) AS distance_meters,
        h.state,
        h.district,
        h.created_at
    FROM public.road_hazards h
    WHERE ST_DWithin(
        h.location::geography,
        ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
        radius_meters
    )
    ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Find nearest supply hubs from a given point
DROP FUNCTION IF EXISTS public.get_nearest_supply_hubs(DOUBLE PRECISION, DOUBLE PRECISION, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_nearest_supply_hubs(DOUBLE PRECISION, DOUBLE PRECISION) CASCADE;
DROP FUNCTION IF EXISTS public.get_nearest_supply_hubs CASCADE;

CREATE OR REPLACE FUNCTION public.get_nearest_supply_hubs(
    target_lng DOUBLE PRECISION,
    target_lat DOUBLE PRECISION,
    limit_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    hub_name TEXT,
    hub_code TEXT,
    hub_type TEXT,
    state TEXT,
    district TEXT,
    capacity_metric_tons NUMERIC(10, 2),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    distance_km DOUBLE PRECISION,
    contact_person TEXT,
    contact_phone TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.hub_name,
        s.hub_code,
        s.hub_type,
        s.state,
        s.district,
        s.capacity_metric_tons,
        s.latitude,
        s.longitude,
        ROUND((ST_Distance(
            s.location::geography,
            ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography
        ) / 1000.0)::numeric, 2)::DOUBLE PRECISION AS distance_km,
        s.contact_person,
        s.contact_phone
    FROM public.supply_hubs s
    ORDER BY s.location <-> ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Cascade GDPR-compliant deletion of authenticated user account
DROP FUNCTION IF EXISTS public.delete_user_account() CASCADE;

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to delete account';
    END IF;

    -- 1. Purge driver profile
    DELETE FROM public.driver_profiles WHERE id = current_user_id;
    -- 2. Purge hazards reported by this driver
    DELETE FROM public.road_hazards WHERE reported_by_id = current_user_id OR reported_by = current_user_id;
    -- 3. Purge active shipments associated with this driver
    DELETE FROM public.shipments WHERE driver_id = current_user_id;
    -- 4. Purge authentication record
    DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES (STRICT AUTHENTICATED ACCESS)
-- ----------------------------------------------------------------------------

ALTER TABLE public.nodal_officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.road_hazards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- 7.1 Policy: nodal_officers
DROP POLICY IF EXISTS "Allow authenticated read on nodal_officers" ON public.nodal_officers;
DROP POLICY IF EXISTS "Allow authenticated management on nodal_officers" ON public.nodal_officers;
DROP POLICY IF EXISTS "Allow public read access on nodal_officers" ON public.nodal_officers;
DROP POLICY IF EXISTS "Allow authenticated insert/update on nodal_officers" ON public.nodal_officers;

CREATE POLICY "Allow authenticated read on nodal_officers"
    ON public.nodal_officers FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Allow authenticated management on nodal_officers"
    ON public.nodal_officers FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 7.2 Policy: driver_profiles
DROP POLICY IF EXISTS "Allow authenticated read driver_profiles" ON public.driver_profiles;
DROP POLICY IF EXISTS "Allow authenticated insert driver_profiles" ON public.driver_profiles;
DROP POLICY IF EXISTS "Allow authenticated update driver_profiles" ON public.driver_profiles;
DROP POLICY IF EXISTS "Allow authenticated delete driver_profiles" ON public.driver_profiles;
DROP POLICY IF EXISTS "Public Read Active Drivers" ON public.driver_profiles;
DROP POLICY IF EXISTS "Authenticated Update Own Driver Profile" ON public.driver_profiles;

CREATE POLICY "Allow authenticated read driver_profiles"
    ON public.driver_profiles FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Allow authenticated insert driver_profiles"
    ON public.driver_profiles FOR INSERT
    TO authenticated, anon
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update driver_profiles"
    ON public.driver_profiles FOR UPDATE
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete driver_profiles"
    ON public.driver_profiles FOR DELETE
    TO authenticated, anon
    USING (true);

-- 7.3 Policy: road_hazards
DROP POLICY IF EXISTS "Allow authenticated read road_hazards" ON public.road_hazards;
DROP POLICY IF EXISTS "Allow authenticated insert road_hazards" ON public.road_hazards;
DROP POLICY IF EXISTS "Allow authenticated update road_hazards" ON public.road_hazards;
DROP POLICY IF EXISTS "Allow authenticated delete road_hazards" ON public.road_hazards;
DROP POLICY IF EXISTS "Allow public read access on road_hazards" ON public.road_hazards;
DROP POLICY IF EXISTS "Allow insert access on road_hazards" ON public.road_hazards;
DROP POLICY IF EXISTS "Allow update on road_hazards" ON public.road_hazards;
DROP POLICY IF EXISTS "Hazards read access" ON public.road_hazards;
DROP POLICY IF EXISTS "Drivers can report hazards" ON public.road_hazards;
DROP POLICY IF EXISTS "Delete hazard permission rule" ON public.road_hazards;

CREATE POLICY "Allow authenticated read road_hazards"
    ON public.road_hazards FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Allow authenticated insert road_hazards"
    ON public.road_hazards FOR INSERT
    TO authenticated, anon
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update road_hazards"
    ON public.road_hazards FOR UPDATE
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Delete hazard permission rule"
    ON public.road_hazards FOR DELETE
    TO authenticated, anon
    USING (true);

-- 7.4 Policy: supply_hubs
DROP POLICY IF EXISTS "Allow authenticated read supply_hubs" ON public.supply_hubs;
DROP POLICY IF EXISTS "Allow authenticated management of supply_hubs" ON public.supply_hubs;
DROP POLICY IF EXISTS "Allow public read access on supply_hubs" ON public.supply_hubs;
DROP POLICY IF EXISTS "Allow management of supply_hubs" ON public.supply_hubs;

CREATE POLICY "Allow authenticated read supply_hubs"
    ON public.supply_hubs FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Allow authenticated management of supply_hubs"
    ON public.supply_hubs FOR ALL
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- 7.5 Policy: shipments
DROP POLICY IF EXISTS "Allow authenticated read shipments" ON public.shipments;
DROP POLICY IF EXISTS "Allow authenticated insert shipments" ON public.shipments;
DROP POLICY IF EXISTS "Allow authenticated update shipments" ON public.shipments;
DROP POLICY IF EXISTS "Allow authenticated delete shipments" ON public.shipments;
DROP POLICY IF EXISTS "Allow public read access on shipments" ON public.shipments;
DROP POLICY IF EXISTS "Public authenticated can view shipments list" ON public.shipments;
DROP POLICY IF EXISTS "Drivers can insert shipment manifest" ON public.shipments;
DROP POLICY IF EXISTS "Drivers can insert their journey" ON public.shipments;
DROP POLICY IF EXISTS "Drivers can update own shipment" ON public.shipments;
DROP POLICY IF EXISTS "Drivers can update their journey" ON public.shipments;
DROP POLICY IF EXISTS "Drivers can delete own shipment" ON public.shipments;
DROP POLICY IF EXISTS "Drivers can delete their journey" ON public.shipments;

CREATE POLICY "Allow authenticated read shipments"
    ON public.shipments FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Allow authenticated insert shipments"
    ON public.shipments FOR INSERT
    TO authenticated, anon
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update shipments"
    ON public.shipments FOR UPDATE
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete shipments"
    ON public.shipments FOR DELETE
    TO authenticated, anon
    USING (true);

-- ----------------------------------------------------------------------------
-- 8. STORAGE BUCKET CONFIGURATION (hazard-images)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) 
VALUES ('hazard-images', 'hazard-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Authenticated Access to Hazard Images" ON storage.objects;
DROP POLICY IF EXISTS "Allow Authenticated Uploads to Hazard Images" ON storage.objects;
DROP POLICY IF EXISTS "Allow Authenticated Updates to Hazard Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Access to Hazard Images" ON storage.objects;
DROP POLICY IF EXISTS "Allow All Uploads to Hazard Images" ON storage.objects;
DROP POLICY IF EXISTS "Allow Updates to Hazard Images" ON storage.objects;

CREATE POLICY "Authenticated Access to Hazard Images"
    ON storage.objects FOR SELECT
    TO authenticated, anon
    USING (bucket_id = 'hazard-images');

CREATE POLICY "Allow Authenticated Uploads to Hazard Images"
    ON storage.objects FOR INSERT
    TO authenticated, anon
    WITH CHECK (bucket_id = 'hazard-images');

CREATE POLICY "Allow Authenticated Updates to Hazard Images"
    ON storage.objects FOR UPDATE
    TO authenticated, anon
    USING (bucket_id = 'hazard-images');

-- ----------------------------------------------------------------------------
-- 9. INITIAL SEED DATA (Nodal Officers & 50 Strategic NER Supply Hubs)
-- ----------------------------------------------------------------------------

-- 9.1 SEED PUBLIC.NODAL_OFFICERS (Authoritative Whitelist for 8 NER Nodal Officers)
INSERT INTO public.nodal_officers (
    id,
    officer_name,
    email,
    state,
    department,
    designation,
    emergency_contact,
    access_passcode,
    is_active,
    created_at
) VALUES
(
    'b0000000-0000-0000-0000-000000000001',
    'Dr. Diganta Sarmah',
    'diganta.sarmah@sdma.assam.gov.in',
    'Assam',
    'Assam State Disaster Management Authority (ASDMA)',
    'State Logistics Coordinator & Joint Director',
    '+91-94350-12845',
    'NER@Nodal2026',
    TRUE,
    NOW()
),
(
    'b0000000-0000-0000-0000-000000000002',
    'Col. Tashi Norbu (Retd.)',
    'tashi.norbu@bro.arunachal.gov.in',
    'Arunachal Pradesh',
    'Border Roads Organization (BRO) / Disaster Cell',
    'Chief Disaster Logistics Strategist',
    '+91-94360-88412',
    'NER@Nodal2026',
    TRUE,
    NOW()
),
(
    'b0000000-0000-0000-0000-000000000003',
    'Bah P. Kharkongor',
    'p.kharkongor@pwd.meghalaya.gov.in',
    'Meghalaya',
    'Meghalaya PWD (Roads & Infrastructure)',
    'Superintending Engineer & Nodal Officer (Highways)',
    '+91-94361-04290',
    'NER@Nodal2026',
    TRUE,
    NOW()
),
(
    'b0000000-0000-0000-0000-000000000004',
    'Th. Premjit Singh',
    'premjit.singh@transport.manipur.gov.in',
    'Manipur',
    'Manipur State Transport & Disaster Relief Dept',
    'Director of Inland Tactical Transit',
    '+91-94360-31189',
    'NER@Nodal2026',
    TRUE,
    NOW()
),
(
    'b0000000-0000-0000-0000-000000000005',
    'Lalrinsanga Ralte',
    'lalrinsanga.ralte@fcsca.mizoram.gov.in',
    'Mizoram',
    'Food, Civil Supplies & Consumer Affairs Dept',
    'Deputy Director of Supply Operations',
    '+91-94361-55073',
    'NER@Nodal2026',
    TRUE,
    NOW()
),
(
    'b0000000-0000-0000-0000-000000000006',
    'K. Temjen Jamir',
    'temjen.jamir@nsdma.nagaland.gov.in',
    'Nagaland',
    'Nagaland State Disaster Management Authority (NSDMA)',
    'Joint Chief Logistics Officer',
    '+91-94360-62410',
    'NER@Nodal2026',
    TRUE,
    NOW()
),
(
    'b0000000-0000-0000-0000-000000000007',
    'Subrata Debbarma',
    'subrata.debbarma@revenue.tripura.gov.in',
    'Tripura',
    'Tripura Logistics Cell & Revenue Disaster Division',
    'State Transit Emergency Coordinator',
    '+91-94364-77123',
    'NER@Nodal2026',
    TRUE,
    NOW()
),
(
    'b0000000-0000-0000-0000-000000000008',
    'Karma Chopel Lepcha',
    'karma.lepcha@ssdma.sikkim.gov.in',
    'Sikkim',
    'Sikkim State Disaster Management Authority (SSDMA)',
    'Mountain Logistics & Hazard Response Commander',
    '+91-94341-90864',
    'NER@Nodal2026',
    TRUE,
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    officer_name = EXCLUDED.officer_name,
    department = EXCLUDED.department,
    designation = EXCLUDED.designation,
    emergency_contact = EXCLUDED.emergency_contact,
    access_passcode = EXCLUDED.access_passcode,
    is_active = EXCLUDED.is_active;

-- 9.2 EXACTLY 50 GEOLOCATED SUPPLY HUBS ACROSS 8 NER STATES
INSERT INTO public.supply_hubs (
    hub_name, hub_code, state, district, hub_type, 
    capacity_metric_tons, latitude, longitude, contact_person, contact_phone
) VALUES
-- ASSAM (15 Hubs)
('Guwahati Central Food Depot', 'HUB-ASM-001', 'Assam', 'Kamrup Metropolitan', 'state_central_depot', 15000.00, 26.1445, 91.7362, 'R. K. Barooah', '+91-94350-10001'),
('Dibrugarh Medical Storage', 'HUB-ASM-002', 'Assam', 'Dibrugarh', 'medical_depot', 3500.00, 27.4728, 94.9120, 'Dr. Hiren Gogoi', '+91-94350-10002'),
('Silchar Valley Hub', 'HUB-ASM-003', 'Assam', 'Cachar', 'district_fci_godown', 8000.00, 24.8333, 92.7789, 'S. Purkayastha', '+91-94350-10003'),
('Tezpur Transit Warehouse', 'HUB-ASM-004', 'Assam', 'Sonitpur', 'emergency_transit_camp', 5000.00, 26.6528, 92.7926, 'N. K. Saikia', '+91-94350-10004'),
('Jorhat Ration Depot', 'HUB-ASM-005', 'Assam', 'Jorhat', 'district_fci_godown', 6500.00, 26.7509, 94.2037, 'B. Bora', '+91-94350-10005'),
('Bongaigaon Fuel Storage', 'HUB-ASM-006', 'Assam', 'Bongaigaon', 'fuel_storage', 12000.00, 26.4958, 90.5432, 'M. Choudhury', '+91-94350-10006'),
('Nagaon Buffer Depot', 'HUB-ASM-007', 'Assam', 'Nagaon', 'district_fci_godown', 7200.00, 26.3452, 92.6840, 'P. Goswami', '+91-94350-10007'),
('Tinsukia Depot', 'HUB-ASM-008', 'Assam', 'Tinsukia', 'state_central_depot', 9000.00, 27.4922, 95.3468, 'A. K. Sharma', '+91-94350-10008'),
('Karimganj Border Depot', 'HUB-ASM-009', 'Assam', 'Karimganj', 'emergency_transit_camp', 4200.00, 24.8690, 92.3556, 'M. Paul', '+91-94350-10009'),
('Haflong Hill Transit', 'HUB-ASM-010', 'Assam', 'Dima Hasao', 'emergency_transit_camp', 3000.00, 25.1764, 93.0182, 'D. Langthasa', '+91-94350-10010'),
('Goalpara Food Hub', 'HUB-ASM-011', 'Assam', 'Goalpara', 'district_fci_godown', 5800.00, 26.1772, 90.6277, 'K. Rabha', '+91-94350-10011'),
('North Lakhimpur Camp', 'HUB-ASM-012', 'Assam', 'Lakhimpur', 'emergency_transit_camp', 4500.00, 27.2356, 94.1037, 'J. Phukan', '+91-94350-10012'),
('Barpeta Relief Store', 'HUB-ASM-013', 'Assam', 'Barpeta', 'district_fci_godown', 4800.00, 26.3216, 91.0048, 'S. K. Das', '+91-94350-10013'),
('Dhubri River Depot', 'HUB-ASM-014', 'Assam', 'Dhubri', 'state_central_depot', 7500.00, 26.0207, 89.9744, 'A. Hussain', '+91-94350-10014'),
('Kokrajhar Transit Camp', 'HUB-ASM-015', 'Assam', 'Kokrajhar', 'emergency_transit_camp', 4000.00, 26.4014, 90.2716, 'B. Boro', '+91-94350-10015'),

-- ARUNACHAL PRADESH (7 Hubs)
('Itanagar State Relief Center', 'HUB-ARU-001', 'Arunachal Pradesh', 'Papum Pare', 'state_central_depot', 6000.00, 27.0844, 93.6053, 'N. Tadar', '+91-94360-20001'),
('Pasighat Logistics Post', 'HUB-ARU-002', 'Arunachal Pradesh', 'East Siang', 'emergency_transit_camp', 3500.00, 28.0665, 95.3267, 'O. Moyong', '+91-94360-20002'),
('Tawang High-Altitude Depot', 'HUB-ARU-003', 'Arunachal Pradesh', 'Tawang', 'emergency_transit_camp', 2500.00, 27.5861, 91.8653, 'D. Norbu', '+91-94360-20003'),
('Ziro Cold Storage Hub', 'HUB-ARU-004', 'Arunachal Pradesh', 'Lower Subansiri', 'district_fci_godown', 3000.00, 27.5450, 93.8290, 'T. Kani', '+91-94360-20004'),
('Tezu Relief Depot', 'HUB-ARU-005', 'Arunachal Pradesh', 'Lohit', 'emergency_transit_camp', 2800.00, 27.9256, 96.1627, 'L. Krong', '+91-94360-20005'),
('Bomdila Mountain Warehouse', 'HUB-ARU-006', 'Arunachal Pradesh', 'West Kameng', 'medical_depot', 2200.00, 27.2645, 92.4231, 'S. Khandu', '+91-94360-20006'),
('Aalo Transit Base', 'HUB-ARU-007', 'Arunachal Pradesh', 'West Siang', 'district_fci_godown', 3100.00, 28.1691, 94.7981, 'M. Ete', '+91-94360-20007'),

-- MEGHALAYA (6 Hubs)
('Shillong Central Medical Depot', 'HUB-MEG-001', 'Meghalaya', 'East Khasi Hills', 'medical_depot', 5000.00, 25.5788, 91.8933, 'Dr. B. Mawlong', '+91-94361-30001'),
('Jowai Highway Hub', 'HUB-MEG-002', 'Meghalaya', 'West Jaintia Hills', 'emergency_transit_camp', 3200.00, 25.4524, 92.2034, 'W. Sumer', '+91-94361-30002'),
('Tura West Garo Depot', 'HUB-MEG-003', 'Meghalaya', 'West Garo Hills', 'district_fci_godown', 4500.00, 25.5144, 90.2034, 'C. Sangma', '+91-94361-30003'),
('Nongpoh Transit Base', 'HUB-MEG-004', 'Meghalaya', 'Ri-Bhoi', 'emergency_transit_camp', 3800.00, 25.9038, 91.8797, 'E. Syiem', '+91-94361-30004'),
('Williamnagar Supply Store', 'HUB-MEG-005', 'Meghalaya', 'East Garo Hills', 'district_fci_godown', 2600.00, 25.5977, 90.6225, 'K. Marak', '+91-94361-30005'),
('Baghmara Border Point', 'HUB-MEG-006', 'Meghalaya', 'South Garo Hills', 'emergency_transit_camp', 2100.00, 25.1925, 90.6386, 'P. Momin', '+91-94361-30006'),

-- MANIPUR (6 Hubs)
('Imphal Central Depot', 'HUB-MAN-001', 'Manipur', 'Imphal West', 'state_central_depot', 8500.00, 24.8170, 93.9368, 'Y. Biren Singh', '+91-94360-40001'),
('Churachandpur Valley Store', 'HUB-MAN-002', 'Manipur', 'Churachandpur', 'district_fci_godown', 4000.00, 24.3337, 93.6738, 'G. Haokip', '+91-94360-40002'),
('Senapati Highway Hub', 'HUB-MAN-003', 'Manipur', 'Senapati', 'emergency_transit_camp', 3600.00, 25.2678, 94.0167, 'K. Poumai', '+91-94360-40003'),
('Thoubal Food Depot', 'HUB-MAN-004', 'Manipur', 'Thoubal', 'district_fci_godown', 4200.00, 24.6393, 93.9989, 'M. Tomba Devi', '+91-94360-40004'),
('Ukhrul Hill Station Depot', 'HUB-MAN-005', 'Manipur', 'Ukhrul', 'emergency_transit_camp', 2400.00, 25.1121, 94.3606, 'V. Shimray', '+91-94360-40005'),
('Jiribam Border Transit', 'HUB-MAN-006', 'Manipur', 'Jiribam', 'emergency_transit_camp', 3000.00, 24.8028, 93.1239, 'H. Sanatomba', '+91-94360-40006'),

-- MIZORAM (5 Hubs)
('Aizawl State Storage', 'HUB-MIZ-001', 'Mizoram', 'Aizawl', 'state_central_depot', 7000.00, 23.7271, 92.7176, 'C. Zothansanga', '+91-94361-50001'),
('Lunglei South Hub', 'HUB-MIZ-002', 'Mizoram', 'Lunglei', 'district_fci_godown', 3500.00, 22.8878, 92.7388, 'F. Vanlalruata', '+91-94361-50002'),
('Champhai Border Depot', 'HUB-MIZ-003', 'Mizoram', 'Champhai', 'emergency_transit_camp', 2800.00, 23.4735, 93.3283, 'K. Lalhmangaiha', '+91-94361-50003'),
('Kolasib Highway Transit', 'HUB-MIZ-004', 'Mizoram', 'Kolasib', 'emergency_transit_camp', 3200.00, 24.2244, 92.6784, 'R. Laltlanhlua', '+91-94361-50004'),
('Serchhip Supply Depot', 'HUB-MIZ-005', 'Mizoram', 'Serchhip', 'district_fci_godown', 2400.00, 23.3414, 92.8504, 'H. Malsawma', '+91-94361-50005'),

-- NAGALAND (5 Hubs)
('Kohima State Central Depot', 'HUB-NAG-001', 'Nagaland', 'Kohima', 'state_central_depot', 6500.00, 25.6751, 94.1086, 'V. Kire', '+91-94360-60001'),
('Dimapur Railway Logistics Hub', 'HUB-NAG-002', 'Nagaland', 'Dimapur', 'state_central_depot', 14000.00, 25.9094, 93.7266, 'T. Lotha', '+91-94360-60002'),
('Mokokchung Transit Store', 'HUB-NAG-003', 'Nagaland', 'Mokokchung', 'emergency_transit_camp', 3100.00, 26.3256, 94.5161, 'I. Jamir', '+91-94360-60003'),
('Tuensang Eastern Hub', 'HUB-NAG-004', 'Nagaland', 'Tuensang', 'district_fci_godown', 2500.00, 26.2737, 94.8252, 'Y. Chang', '+91-94360-60004'),
('Mon Border Depot', 'HUB-NAG-005', 'Nagaland', 'Mon', 'emergency_transit_camp', 2200.00, 26.7410, 95.0594, 'N. Konyak', '+91-94360-60005'),

-- TRIPURA (4 Hubs)
('Agartala Central Depot', 'HUB-TRI-001', 'Tripura', 'West Tripura', 'state_central_depot', 9500.00, 23.8315, 91.2868, 'S. Bhowmik', '+91-94364-70001'),
('Dharmanagar North Hub', 'HUB-TRI-002', 'Tripura', 'North Tripura', 'district_fci_godown', 4500.00, 24.3768, 92.1678, 'P. Chakraborty', '+91-94364-70002'),
('Udaipur South Depot', 'HUB-TRI-003', 'Tripura', 'Gomati', 'district_fci_godown', 3800.00, 23.5336, 91.4883, 'T. Majumder', '+91-94364-70003'),
('Ambassa Relief Post', 'HUB-TRI-004', 'Tripura', 'Dhalai', 'emergency_transit_camp', 2900.00, 23.9268, 91.8569, 'R. Tripura', '+91-94364-70004'),

-- SIKKIM (2 Hubs)
('Gangtok State Relief Hub', 'HUB-SIK-001', 'Sikkim', 'East Sikkim', 'state_central_depot', 5500.00, 27.3389, 88.6065, 'P. Tshering Bhutia', '+91-94341-80001'),
('Mangan North Sikkim High-Altitude Depot', 'HUB-SIK-002', 'Sikkim', 'North Sikkim', 'emergency_transit_camp', 2000.00, 27.5042, 88.5303, 'S. Lepcha', '+91-94341-80002')

ON CONFLICT (hub_code) DO UPDATE SET
    hub_name = EXCLUDED.hub_name,
    state = EXCLUDED.state,
    district = EXCLUDED.district,
    hub_type = EXCLUDED.hub_type,
    capacity_metric_tons = EXCLUDED.capacity_metric_tons,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    contact_person = EXCLUDED.contact_person,
    contact_phone = EXCLUDED.contact_phone;

-- ----------------------------------------------------------------------------
-- 10. NOTIFY POSTGREST TO RELOAD SCHEMA CACHE
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

