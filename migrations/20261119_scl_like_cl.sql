-- Special Casual Leave follows every rule of Casual Leave when a leave is applied (stages, notice, half days, spells, days per
-- application, combining, sandwich, contact address, prefix/suffix, certificate...). Its quota and balance stay its own: the
-- balance is imported, and only persons with disability (PwD) can take it, so the import and the leave form both refuse others.
UPDATE leave_types s
  JOIN leave_types c ON c.code = 'CL'
SET s.approval_stages = c.approval_stages,
    s.hod_after_days = c.hod_after_days,
    s.min_notice_days = c.min_notice_days,
    s.half_day_allowed = c.half_day_allowed,
    s.medical_cert_days = c.medical_cert_days,
    s.certificate_required = c.certificate_required,
    s.sandwich_rule = c.sandwich_rule,
    s.combine_with = c.combine_with,
    s.max_consecutive_days = c.max_consecutive_days,
    s.min_days_per_application = c.min_days_per_application,
    s.max_spells_per_year = c.max_spells_per_year,
    s.max_spells_per_month = c.max_spells_per_month,
    s.max_spells_lifetime = c.max_spells_lifetime,
    s.lifetime_max = c.lifetime_max,
    s.min_service_months = c.min_service_months,
    s.employee_types = c.employee_types,
    s.joining_required = c.joining_required,
    s.fitness_certificate = c.fitness_certificate,
    s.needs_contact = c.needs_contact,
    s.ltc_allowed = c.ltc_allowed,
    s.prefix_suffix = c.prefix_suffix,
    s.off_days_only = c.off_days_only,
    s.gender = 'all',
    s.pwd_only = 1
WHERE s.code = 'SCL' AND s.id > 0;
