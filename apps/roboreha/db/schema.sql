CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  address text NOT NULL,
  phone text NOT NULL,
  visit_enabled boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'Asia/Tokyo',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stores ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS manager_name text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS open_time time NOT NULL DEFAULT time '10:00';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS close_time time NOT NULL DEFAULT time '18:00';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS closed_weekdays smallint[] NOT NULL DEFAULT ARRAY[3,4]::smallint[];
ALTER TABLE stores ADD COLUMN IF NOT EXISTS feature_flags jsonb NOT NULL DEFAULT '{"appointments":true,"customers":true,"messages":true,"intake":true,"equipment":true,"physical":true,"clinical":true,"billing":true,"staff":true}'::jsonb;

UPDATE stores
   SET feature_flags = '{"appointments":true,"customers":true,"messages":true,"intake":true,"equipment":true,"physical":true,"clinical":true,"billing":true,"staff":true}'::jsonb
 WHERE feature_flags IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_status_check') THEN
    ALTER TABLE stores ADD CONSTRAINT stores_status_check CHECK (status IN ('active', 'preparing', 'suspended'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  employee_code text NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('therapist', 'trainer', 'reception', 'manager')),
  qualification text,
  hal_training_valid_until date,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (store_id, employee_code)
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  customer_code text NOT NULL,
  name text NOT NULL,
  name_kana text NOT NULL,
  birth_date date NOT NULL,
  phone text NOT NULL,
  email text,
  primary_condition text,
  goal text,
  emergency_contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, customer_code)
);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS diagnosis_name text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_payment_method text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_preferred_payment_method_check') THEN
    ALTER TABLE customers ADD CONSTRAINT customers_preferred_payment_method_check
      CHECK (preferred_payment_method IS NULL OR preferred_payment_method IN ('cash', 'credit_card', 'qr', 'ticket'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS customer_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE REFERENCES customers(id),
  store_id uuid NOT NULL REFERENCES stores(id),
  registration_channel text NOT NULL DEFAULT 'smartphone' CHECK (registration_channel IN ('smartphone', 'facility')),
  consent_privacy boolean NOT NULL CHECK (consent_privacy),
  consent_contact boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'contacted')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hal_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  asset_code text NOT NULL,
  serial_number text NOT NULL UNIQUE,
  product_class text NOT NULL CHECK (product_class IN ('wellbeing', 'medical', 'care', 'work')),
  model_type text NOT NULL CHECK (model_type IN ('lower_limb', 'single_joint', 'lumbar')),
  model_number text NOT NULL,
  size_label text,
  laterality text CHECK (laterality IN ('bilateral', 'left', 'right', 'not_applicable')),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'inspection', 'repair', 'retired')),
  battery_percent integer CHECK (battery_percent BETWEEN 0 AND 100),
  last_inspected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, asset_code)
);

ALTER TABLE hal_units ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0;
ALTER TABLE hal_units ADD COLUMN IF NOT EXISTS body_part text;
ALTER TABLE hal_units ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE hal_units ADD COLUMN IF NOT EXISTS image_source_url text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hal_units_usage_count_check') THEN
    ALTER TABLE hal_units ADD CONSTRAINT hal_units_usage_count_check CHECK (usage_count >= 0);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hal_units_body_part_check') THEN
    ALTER TABLE hal_units ADD CONSTRAINT hal_units_body_part_check
      CHECK (body_part IS NULL OR body_part IN ('upper_limb', 'lower_limb', 'lumbar'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS facility_equipment_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  category text NOT NULL CHECK (category IN ('hal', 'treadmill', 'bench')),
  equipment_name text NOT NULL,
  model_number text NOT NULL,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0 AND quantity <= 999),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, category, model_number)
);

ALTER TABLE facility_equipment_models ADD COLUMN IF NOT EXISTS hal_capacity_per_unit integer NOT NULL DEFAULT 1;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facility_equipment_hal_capacity_check') THEN
    ALTER TABLE facility_equipment_models ADD CONSTRAINT facility_equipment_hal_capacity_check
      CHECK (hal_capacity_per_unit BETWEEN 1 AND 20);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS service_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  code text NOT NULL,
  name text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  price_yen integer NOT NULL CHECK (price_yen >= 0),
  required_model_type text CHECK (required_model_type IN ('lower_limb', 'single_joint', 'lumbar')),
  active boolean NOT NULL DEFAULT true,
  UNIQUE (store_id, code)
);

CREATE TABLE IF NOT EXISTS ticket_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  product_id uuid NOT NULL REFERENCES service_products(id),
  remaining_uses integer NOT NULL CHECK (remaining_uses >= 0),
  expires_on date NOT NULL,
  UNIQUE (customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS ticket_purchase_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  store_id uuid NOT NULL REFERENCES stores(id),
  product_id uuid NOT NULL REFERENCES service_products(id),
  ticket_type integer NOT NULL CHECK (ticket_type IN (5, 10)),
  purchased_uses integer NOT NULL CHECK (purchased_uses IN (5, 10)),
  amount_yen integer NOT NULL CHECK (amount_yen >= 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'credit_card', 'qr')),
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_on date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'refunded', 'void')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ticket_purchase_history_customer_date_idx
  ON ticket_purchase_history(customer_id, purchased_at DESC);

CREATE TABLE IF NOT EXISTS rehabilitation_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  space_code text NOT NULL,
  name text NOT NULL,
  space_type text NOT NULL CHECK (space_type IN ('treadmill', 'bench')),
  capacity_hal_units integer NOT NULL DEFAULT 1 CHECK (capacity_hal_units BETWEEN 1 AND 20),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, space_code)
);

CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  therapist_id uuid NOT NULL REFERENCES staff_members(id),
  hal_unit_id uuid REFERENCES hal_units(id),
  rehab_space_id uuid REFERENCES rehabilitation_spaces(id),
  product_id uuid NOT NULL REFERENCES service_products(id),
  appointment_type text NOT NULL DEFAULT 'in_store' CHECK (appointment_type IN ('in_store', 'home_visit')),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'checked_in', 'in_session', 'completed', 'cancelled', 'no_show')),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  source_appointment_id uuid REFERENCES appointments(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS rehab_space_id uuid REFERENCES rehabilitation_spaces(id);

CREATE OR REPLACE FUNCTION enforce_rehabilitation_space_capacity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  selected_type text;
  selected_capacity integer;
  hal_type text;
  overlapping_count integer;
BEGIN
  IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM appointments WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;
  IF NEW.rehab_space_id IS NULL OR NEW.status NOT IN ('reserved','confirmed','checked_in','in_session') THEN
    RETURN NEW;
  END IF;
  SELECT space_type, capacity_hal_units INTO selected_type, selected_capacity
    FROM rehabilitation_spaces WHERE id=NEW.rehab_space_id AND store_id=NEW.store_id AND active=true;
  IF selected_type IS NULL THEN RAISE EXCEPTION '選択したリハスペースは利用できません。'; END IF;
  SELECT model_type INTO hal_type FROM hal_units WHERE id=NEW.hal_unit_id AND store_id=NEW.store_id;
  IF hal_type='lower_limb' AND selected_type<>'treadmill' THEN
    RAISE EXCEPTION '下肢タイプHALにはトレッドミルを割り当ててください。';
  ELSIF hal_type IN ('single_joint','lumbar') AND selected_type<>'bench' THEN
    RAISE EXCEPTION '単関節・腰タイプHALにはベンチを割り当ててください。';
  END IF;
  SELECT count(*) INTO overlapping_count FROM appointments a
   WHERE a.rehab_space_id=NEW.rehab_space_id AND a.id<>NEW.id
     AND a.status IN ('reserved','confirmed','checked_in','in_session')
     AND tstzrange(a.start_at,a.end_at,'[)') && tstzrange(NEW.start_at,NEW.end_at,'[)');
  IF overlapping_count >= selected_capacity THEN
    RAISE EXCEPTION '選択したリハスペースは同じ時間に使用上限へ達しています。';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS appointments_rehabilitation_space_capacity ON appointments;
CREATE TRIGGER appointments_rehabilitation_space_capacity
BEFORE INSERT OR UPDATE OF rehab_space_id, hal_unit_id, start_at, end_at, status ON appointments
FOR EACH ROW EXECUTE FUNCTION enforce_rehabilitation_space_capacity();

CREATE TABLE IF NOT EXISTS appointment_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id),
  action text NOT NULL CHECK (action IN ('create', 'move', 'cancel', 'restore')),
  before_state jsonb,
  after_state jsonb,
  changed_by uuid NOT NULL REFERENCES staff_members(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'no_customer_overlap' AND conrelid = 'appointments'::regclass) THEN
    ALTER TABLE appointments ADD CONSTRAINT no_customer_overlap
      EXCLUDE USING gist (customer_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
      WHERE (status IN ('reserved', 'confirmed', 'checked_in', 'in_session'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'no_therapist_overlap' AND conrelid = 'appointments'::regclass) THEN
    ALTER TABLE appointments ADD CONSTRAINT no_therapist_overlap
      EXCLUDE USING gist (therapist_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
      WHERE (status IN ('reserved', 'confirmed', 'checked_in', 'in_session'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'no_hal_overlap' AND conrelid = 'appointments'::regclass) THEN
    ALTER TABLE appointments ADD CONSTRAINT no_hal_overlap
      EXCLUDE USING gist (hal_unit_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
      WHERE (hal_unit_id IS NOT NULL AND status IN ('reserved', 'confirmed', 'checked_in', 'in_session'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS safety_rule_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  name text NOT NULL,
  systolic_stop_low numeric,
  systolic_stop_high numeric,
  diastolic_stop_low numeric,
  diastolic_stop_high numeric,
  pulse_stop_low numeric,
  pulse_stop_high numeric,
  temperature_stop_low numeric,
  temperature_stop_high numeric,
  effective_from date NOT NULL,
  effective_to date,
  source_note text NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS vital_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id),
  measured_by uuid NOT NULL REFERENCES staff_members(id),
  systolic numeric NOT NULL,
  diastolic numeric NOT NULL,
  pulse numeric NOT NULL,
  temperature numeric(3,1) NOT NULL,
  decision text NOT NULL CHECK (decision IN ('allow', 'review', 'stop')),
  triggered_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  staff_note text,
  measured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clinical_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES appointments(id),
  hal_unit_id uuid NOT NULL REFERENCES hal_units(id),
  operator_id uuid NOT NULL REFERENCES staff_members(id),
  attachment_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  electrode_positions jsonb NOT NULL DEFAULT '[]'::jsonb,
  control_parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  exercise_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  soap jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES appointments(id),
  store_id uuid NOT NULL REFERENCES stores(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  amount_yen integer NOT NULL CHECK (amount_yen >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'void')),
  payment_method text CHECK (payment_method IN ('cash', 'credit_card', 'qr', 'ticket')),
  confirmed_by uuid REFERENCES staff_members(id),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff_members(id),
  store_id uuid NOT NULL REFERENCES stores(id),
  work_date date NOT NULL,
  clock_in timestamptz,
  clock_out timestamptz,
  break_minutes integer NOT NULL DEFAULT 60 CHECK (break_minutes BETWEEN 0 AND 480),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  approved_by uuid REFERENCES staff_members(id),
  approved_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, work_date),
  CHECK (clock_out IS NULL OR clock_in IS NULL OR clock_out > clock_in)
);

CREATE TABLE IF NOT EXISTS staff_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff_members(id),
  store_id uuid NOT NULL REFERENCES stores(id),
  work_date date NOT NULL,
  shift_start timestamptz NOT NULL,
  shift_end timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'absent', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, work_date),
  CHECK (shift_end > shift_start)
);

CREATE TABLE IF NOT EXISTS intake_questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  store_id uuid NOT NULL REFERENCES stores(id),
  chief_complaint text NOT NULL,
  medical_history text,
  medications text,
  pacemaker boolean NOT NULL DEFAULT false,
  fracture_risk boolean NOT NULL DEFAULT false,
  skin_issue boolean NOT NULL DEFAULT false,
  fall_history boolean NOT NULL DEFAULT false,
  walking_aid text,
  pain_scale integer CHECK (pain_scale BETWEEN 0 AND 10),
  consent_terms boolean NOT NULL DEFAULT false,
  consent_media boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'reviewed')),
  reviewed_by uuid REFERENCES staff_members(id),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE intake_questionnaires
  ADD COLUMN IF NOT EXISTS custom_responses jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS customer_cautions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'caution' CHECK (severity IN ('caution', 'high')),
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('mobility', 'medical', 'communication', 'behavior', 'support', 'other')),
  title text NOT NULL,
  detail text NOT NULL,
  response_note text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES staff_members(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questionnaire_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '初診問診票',
  introduction_text text NOT NULL DEFAULT '安全にリハビリを行うため、現在の状態をお知らせください。',
  consent_text text NOT NULL DEFAULT '利用規約と安全確認事項を確認し、問診内容の施設内利用に同意します。',
  updated_by uuid REFERENCES staff_members(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questionnaire_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES questionnaire_templates(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  label text NOT NULL,
  help_text text,
  field_type text NOT NULL CHECK (field_type IN ('short_text', 'long_text', 'number', 'single_choice', 'multiple_choice', 'boolean', 'video')),
  required boolean NOT NULL DEFAULT false,
  unit text,
  min_value numeric,
  max_value numeric,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  system_field text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, item_key),
  CHECK (max_value IS NULL OR min_value IS NULL OR max_value >= min_value)
);

CREATE TABLE IF NOT EXISTS clinical_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES appointments(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  evaluator_id uuid NOT NULL REFERENCES staff_members(id),
  pre_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  post_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  delta_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary_text text NOT NULL,
  notes text,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessment_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES clinical_assessments(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN ('before', 'after')),
  original_file_name text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assessment_videos_phase_check') THEN
    ALTER TABLE assessment_videos DROP CONSTRAINT assessment_videos_phase_check;
  END IF;
  ALTER TABLE assessment_videos ADD CONSTRAINT assessment_videos_phase_check
    CHECK (phase IN ('before', 'after', 'analysis'));
END $$;

CREATE TABLE IF NOT EXISTS gait_ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL UNIQUE REFERENCES clinical_assessments(id) ON DELETE CASCADE,
  analysis_video_id uuid REFERENCES assessment_videos(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'failed')),
  gait_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  improvement_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_notes text NOT NULL,
  comment_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_label text NOT NULL DEFAULT '試作AI推定',
  disclaimer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS measurement_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  version text NOT NULL DEFAULT '1.0',
  unit text NOT NULL,
  lower_is_better boolean NOT NULL DEFAULT false,
  instructions text NOT NULL,
  video_supported boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code, version)
);

CREATE TABLE IF NOT EXISTS physical_function_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  appointment_id uuid UNIQUE REFERENCES appointments(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES customers(id),
  evaluator_id uuid NOT NULL REFERENCES staff_members(id),
  hal_unit_id uuid REFERENCES hal_units(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','analyzing','reviewed','finalized')),
  capture_condition text NOT NULL DEFAULT 'without_hal' CHECK (capture_condition IN ('without_hal','with_hal_lower_limb','with_hal_lumbar')),
  hal_size text CHECK (hal_size IS NULL OR hal_size IN ('S','L')),
  assistance_level text NOT NULL DEFAULT 'supervision' CHECK (assistance_level IN ('independent','supervision','light','moderate','maximum')),
  assistive_device text NOT NULL DEFAULT 'none' CHECK (assistive_device IN ('none','cane','walker','handrail','other')),
  walking_distance_m numeric(5,2) NOT NULL DEFAULT 4 CHECK (walking_distance_m > 0 AND walking_distance_m <= 100),
  camera_view text NOT NULL DEFAULT 'side' CHECK (camera_view IN ('side','rear','front','diagonal')),
  protocol_version text NOT NULL DEFAULT 'roboreha-fg-lite-1.0',
  notes text NOT NULL DEFAULT '',
  clinician_summary text NOT NULL DEFAULT '',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS physical_function_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES physical_function_sessions(id) ON DELETE CASCADE,
  measurement_code text NOT NULL,
  side text NOT NULL DEFAULT 'none' CHECK (side IN ('none','left','right')),
  trial_number integer NOT NULL DEFAULT 1 CHECK (trial_number BETWEEN 1 AND 10),
  value numeric(10,3) NOT NULL,
  unit text NOT NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','video_ai','legacy')),
  valid boolean NOT NULL DEFAULT true,
  invalid_reason text,
  confidence numeric(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, measurement_code, side, trial_number, source)
);

CREATE TABLE IF NOT EXISTS physical_function_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES physical_function_sessions(id) ON DELETE CASCADE,
  test_code text NOT NULL DEFAULT 'gait',
  phase text NOT NULL DEFAULT 'measurement' CHECK (phase IN ('measurement','baseline','hal_assisted','analysis')),
  original_file_name text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  duration_seconds numeric(7,2),
  width integer,
  height integer,
  fps numeric(5,2),
  consent_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS motion_analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES physical_function_sessions(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES physical_function_videos(id) ON DELETE CASCADE,
  engine_version text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','needs_review','failed')),
  patient_track_id text,
  helper_track_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  pose_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (video_id, engine_version)
);

CREATE TABLE IF NOT EXISTS gait_analysis_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL UNIQUE REFERENCES motion_analysis_jobs(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES physical_function_sessions(id) ON DELETE CASCADE,
  walking_time_seconds numeric(8,3),
  walking_speed_mps numeric(8,3),
  step_count integer,
  cadence_spm numeric(8,3),
  left_step_length_m numeric(8,3),
  right_step_length_m numeric(8,3),
  symmetry_percent numeric(8,3),
  trunk_lean_degrees numeric(8,3),
  left_knee_flexion_degrees numeric(8,3),
  right_knee_flexion_degrees numeric(8,3),
  helper_overlap_percent numeric(8,3),
  confidence numeric(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  clinician_reviewed boolean NOT NULL DEFAULT false,
  reviewed_by uuid REFERENCES staff_members(id),
  reviewed_at timestamptz,
  raw_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS physical_function_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES physical_function_sessions(id) ON DELETE CASCADE,
  report_status text NOT NULL DEFAULT 'draft' CHECK (report_status IN ('draft','finalized')),
  summary text NOT NULL DEFAULT '',
  improvement_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  comment_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  disclaimer text NOT NULL,
  finalized_by uuid REFERENCES staff_members(id),
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  target_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);

CREATE TABLE IF NOT EXISTS training_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES physical_function_sessions(id) ON DELETE CASCADE,
  training_program_id uuid NOT NULL REFERENCES training_programs(id),
  reason text NOT NULL,
  clinician_approved boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES staff_members(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, training_program_id)
);

CREATE OR REPLACE FUNCTION enforce_facility_rehab_capacity() RETURNS trigger AS $$
DECLARE
  required_type text;
  resource_category text;
  capacity integer;
  concurrent_count integer;
BEGIN
  IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM appointments WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('reserved', 'confirmed', 'checked_in', 'in_session') THEN
    RETURN NEW;
  END IF;

  SELECT required_model_type INTO required_type FROM service_products WHERE id = NEW.product_id;
  IF required_type = 'lower_limb' THEN
    resource_category := 'treadmill';
  ELSIF required_type IN ('single_joint','lumbar') THEN
    resource_category := 'bench';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.store_id::text || ':' || resource_category));
  SELECT COALESCE(sum(quantity * hal_capacity_per_unit), 0)::integer INTO capacity
    FROM facility_equipment_models
   WHERE store_id = NEW.store_id AND category = resource_category;

  SELECT count(*)::integer INTO concurrent_count
    FROM appointments a
    JOIN service_products p ON p.id = a.product_id
   WHERE a.store_id = NEW.store_id
     AND a.id <> NEW.id
     AND a.status IN ('reserved', 'confirmed', 'checked_in', 'in_session')
     AND a.start_at < NEW.end_at AND a.end_at > NEW.start_at
     AND CASE WHEN p.required_model_type='lower_limb' THEN 'treadmill' ELSE 'bench' END = resource_category;

  IF concurrent_count >= capacity THEN
    IF resource_category = 'treadmill' THEN
      RAISE EXCEPTION '下肢タイプの予約にはトレッドミルが1台必要です。設定された同時使用可能数を超えています。' USING ERRCODE = 'P0001';
    ELSE
      RAISE EXCEPTION '腰タイプの予約がベンチの同時使用可能HAL台数を超えています。' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointments_facility_capacity_trigger ON appointments;
CREATE TRIGGER appointments_facility_capacity_trigger
  BEFORE INSERT OR UPDATE OF store_id, product_id, start_at, end_at, status ON appointments
  FOR EACH ROW EXECUTE FUNCTION enforce_facility_rehab_capacity();

CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES appointments(id),
  hal_unit_id uuid REFERENCES hal_units(id),
  severity text NOT NULL CHECK (severity IN ('minor', 'moderate', 'serious')),
  category text NOT NULL,
  description text NOT NULL,
  immediate_action text NOT NULL,
  reported_by uuid NOT NULL REFERENCES staff_members(id),
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointments_store_start_idx ON appointments (store_id, start_at);
CREATE INDEX IF NOT EXISTS appointments_customer_start_idx ON appointments (customer_id, start_at DESC);
CREATE INDEX IF NOT EXISTS appointment_change_logs_appointment_idx ON appointment_change_logs (appointment_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS vital_checks_appointment_idx ON vital_checks (appointment_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS facility_equipment_store_category_idx ON facility_equipment_models (store_id, category);
CREATE INDEX IF NOT EXISTS clinical_assessments_customer_date_idx ON clinical_assessments (customer_id, assessed_at DESC);
CREATE INDEX IF NOT EXISTS assessment_videos_assessment_phase_idx ON assessment_videos (assessment_id, phase);
CREATE INDEX IF NOT EXISTS gait_ai_analyses_assessment_idx ON gait_ai_analyses (assessment_id);
CREATE INDEX IF NOT EXISTS physical_function_sessions_customer_date_idx ON physical_function_sessions (customer_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS physical_function_sessions_store_date_idx ON physical_function_sessions (store_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS physical_function_measurements_session_idx ON physical_function_measurements (session_id, measurement_code);
CREATE INDEX IF NOT EXISTS physical_function_videos_session_idx ON physical_function_videos (session_id, test_code, phase);
CREATE INDEX IF NOT EXISTS motion_analysis_jobs_session_idx ON motion_analysis_jobs (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS gait_analysis_results_session_idx ON gait_analysis_results (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS billing_records_store_paid_idx ON billing_records (store_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS attendance_records_store_date_idx ON attendance_records (store_id, work_date DESC);
CREATE INDEX IF NOT EXISTS staff_shifts_store_date_idx ON staff_shifts (store_id, work_date, shift_start);
CREATE INDEX IF NOT EXISTS intake_questionnaires_customer_idx ON intake_questionnaires (customer_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS customer_cautions_customer_active_idx ON customer_cautions (customer_id, active);
CREATE INDEX IF NOT EXISTS questionnaire_template_items_template_order_idx ON questionnaire_template_items (template_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS customer_registrations_store_submitted_idx ON customer_registrations (store_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS rehabilitation_spaces_store_type_idx ON rehabilitation_spaces (store_id, space_type, active);
CREATE INDEX IF NOT EXISTS appointments_rehab_space_time_idx ON appointments (rehab_space_id, start_at, end_at);

CREATE TABLE IF NOT EXISTS message_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, customer_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES message_conversations(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('customer', 'facility', 'ai')),
  sender_customer_id uuid REFERENCES customers(id),
  sender_staff_id uuid REFERENCES staff_members(id),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  sent_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CHECK (
    (sender_type = 'customer' AND sender_customer_id IS NOT NULL AND sender_staff_id IS NULL)
    OR
    (sender_type = 'facility' AND sender_staff_id IS NOT NULL AND sender_customer_id IS NULL)
    OR
    (sender_type = 'ai' AND sender_staff_id IS NULL AND sender_customer_id IS NULL)
  )
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='messages_sender_type_check' AND conrelid='messages'::regclass) THEN
    ALTER TABLE messages DROP CONSTRAINT messages_sender_type_check;
  END IF;
  ALTER TABLE messages ADD CONSTRAINT messages_sender_type_check CHECK (sender_type IN ('customer','facility','ai'));
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='messages_check' AND conrelid='messages'::regclass) THEN
    ALTER TABLE messages DROP CONSTRAINT messages_check;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='messages_sender_identity_check' AND conrelid='messages'::regclass) THEN
    ALTER TABLE messages DROP CONSTRAINT messages_sender_identity_check;
  END IF;
  ALTER TABLE messages ADD CONSTRAINT messages_sender_identity_check CHECK (
    (sender_type='customer' AND sender_customer_id IS NOT NULL AND sender_staff_id IS NULL)
    OR (sender_type='facility' AND sender_staff_id IS NOT NULL AND sender_customer_id IS NULL)
    OR (sender_type='ai' AND sender_staff_id IS NULL AND sender_customer_id IS NULL)
  );
END $$;

CREATE TABLE IF NOT EXISTS ai_chat_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  store_id uuid NOT NULL REFERENCES stores(id),
  consent_version text NOT NULL,
  notices jsonb NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (customer_id, consent_version)
);

CREATE TABLE IF NOT EXISTS ai_chat_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES message_conversations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  question_message_id uuid NOT NULL REFERENCES messages(id),
  answer_message_id uuid NOT NULL REFERENCES messages(id),
  input_method text NOT NULL CHECK (input_method IN ('text','voice')),
  response_style text NOT NULL,
  safety_classification text NOT NULL CHECK (safety_classification IN ('routine','contact_facility','emergency')),
  context_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider text NOT NULL,
  model_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS message_conversations_store_updated_idx
  ON message_conversations (store_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS messages_conversation_sent_idx
  ON messages (conversation_id, sent_at, id);
CREATE INDEX IF NOT EXISTS messages_unread_idx
  ON messages (conversation_id, sender_type, sent_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS ai_chat_consents_customer_idx
  ON ai_chat_consents (customer_id, accepted_at DESC) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS ai_chat_interactions_customer_idx
  ON ai_chat_interactions (customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS private_preview_sessions (
  token_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS private_preview_sessions_expiry_idx
  ON private_preview_sessions (expires_at);
