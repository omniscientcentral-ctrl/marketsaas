ALTER TABLE public.company_settings
  ADD COLUMN alert_days_critical integer NOT NULL DEFAULT 7,
  ADD COLUMN alert_days_warning integer NOT NULL DEFAULT 15,
  ADD COLUMN alert_days_notice integer NOT NULL DEFAULT 30;