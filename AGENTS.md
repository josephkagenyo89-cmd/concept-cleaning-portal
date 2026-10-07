
- HR employees live in `employees` (not `profiles`); employee codes, timeline events and audit logs are written by database triggers so the UI never duplicates them.
- Payroll lives in employee_compensation, employee_pay_components, payroll_runs and payroll_items; Kenyan statutory math is in src/lib/payroll.ts and items are snapshots, locked by DB trigger once a run is approved, so past payslips never change.
- Public website: '/' is the corporate landing page, the service catalogue lives at '/marketplace', and blog posts live in `blog_posts` (public reads only published rows; admins manage via /admin/blog) so content is edited without code changes.
