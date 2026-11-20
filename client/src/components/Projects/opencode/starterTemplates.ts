export type StarterDomainId =
  | 'all'
  | 'business'
  | 'finance'
  | 'healthcare'
  | 'education'
  | 'retail'
  | 'legal'
  | 'operations';

export interface StarterTemplateItem {
  id: string;
  domain: Exclude<StarterDomainId, 'all'>;
  badge: string;
  title: string;
  subtitle: string;
  prompt: string;
  thumbnail?: string;
}

export const STARTER_DOMAIN_TABS: Array<{ id: StarterDomainId; label: string }> = [
  { id: 'all', label: 'All Domains' },
  { id: 'business', label: 'Business & Sales' },
  { id: 'finance', label: 'Finance & Live Data' },
  { id: 'healthcare', label: 'Healthcare & Clinic' },
  { id: 'education', label: 'Education & Schools' },
  { id: 'retail', label: 'E-Commerce & Retail' },
  { id: 'legal', label: 'Legal & Compliance' },
  { id: 'operations', label: 'Operations & HR' },
];

export const VIBE_STARTER_TEMPLATES: StarterTemplateItem[] = [
  {
    id: 'crm-pipeline',
    domain: 'business',
    badge: 'Business',
    title: 'CRM & Sales Pipeline',
    subtitle: 'Manage leads, deal stages, follow-ups, notes, and conversion metrics.',
    prompt:
      'Build a modern CRM & Sales Pipeline web app to manage customer leads, deal stages (New, Qualified, Proposal, Won), follow-up reminders, notes, instant search, and conversion metrics backed by persistent JSON server storage.',
  },
  {
    id: 'gst-invoice-builder',
    domain: 'business',
    badge: 'Business',
    title: 'GST Invoice & Client Billing',
    subtitle: 'Create itemized GST/tax invoices, calculate CGST/SGST, and export printable bills.',
    prompt:
      'Build a professional GST Invoice & Client Billing app where small businesses can add clients, itemized line items with HSN/SAC codes, automatic CGST/SGST/IGST calculation, payment status tracking, and a clean print/PDF invoice view.',
  },
  {
    id: 'live-web-price-monitor',
    domain: 'finance',
    badge: 'Finance',
    title: 'Live Market & Metals Monitor',
    subtitle: 'Real-time live web scraper, gold/silver price ticker, and top stories feed.',
    prompt:
      'Build a real-time web monitor and metals price tracker dashboard with automatic periodic updates, live gold/silver prices, top stories extraction, alert thresholds, and clean metric cards.',
  },
  {
    id: 'expense-cashflow-tracker',
    domain: 'finance',
    badge: 'Finance',
    title: 'Expense & Cashflow Analytics',
    subtitle: 'Track income, monthly budgets, category charts, and CSV export.',
    prompt:
      'Build a clean Expense & Cashflow Analytics dashboard with income/expense entry forms, monthly budget progress bars, category breakdown charts, search filters, and 1-click CSV export backed by a REST API.',
  },
  {
    id: 'clinic-queue-manager',
    domain: 'healthcare',
    badge: 'Healthcare',
    title: 'Clinic Appointment & Patient Queue',
    subtitle: 'Doctor slots, walk-in token queue, patient vitals, and check-in status.',
    prompt:
      'Build a Clinic Appointment & Patient Queue Manager with doctor schedules, walk-in token numbering, waiting/in-consultation/completed status board, patient contact & vitals notes, and live queue display.',
  },
  {
    id: 'lab-prescription-portal',
    domain: 'healthcare',
    badge: 'Healthcare',
    title: 'Lab Report & Prescription Tracker',
    subtitle: 'Record test panels, reference ranges, abnormal flags, and printable summaries.',
    prompt:
      'Build a Lab Report & Prescription Portal for clinics to log patient lab results with normal reference ranges, automatic high/low flags, dosage schedules, search by patient ID, and printable summary sheets.',
  },
  {
    id: 'student-attendance-gradebook',
    domain: 'education',
    badge: 'Education',
    title: 'School Attendance & Gradebook',
    subtitle: 'Daily class roll call, subject marks, GPA calculation, and parent reports.',
    prompt:
      'Build a School Attendance & Gradebook Portal for teachers with class rosters, 1-click daily attendance marking, exam score entry, automatic percentage/grade calculations, attendance alerts, and printable student report cards.',
  },
  {
    id: 'interactive-quiz-builder',
    domain: 'education',
    badge: 'Education',
    title: 'Interactive Quiz & Exam Studio',
    subtitle: 'Timed MCQ exams, instant auto-grading, score leaderboard, and answer review.',
    prompt:
      'Build an Interactive Quiz & Exam Builder where teachers create timed multiple-choice quizzes with explanations, students take tests with a live countdown timer, and results show instant auto-grading and question-by-question review.',
  },
  {
    id: 'inventory-pos-dashboard',
    domain: 'retail',
    badge: 'Retail',
    title: 'Inventory & POS Order Desk',
    subtitle: 'SKU stock levels, low-stock alerts, quick checkout cart, and daily sales.',
    prompt:
      'Build an Inventory & Point-of-Sale Order Dashboard for retail shops with SKU catalog, stock quantity tracking, automatic low-stock alerts, quick barcode/search checkout cart, receipt generator, and daily sales summary.',
  },
  {
    id: 'product-catalog-storefront',
    domain: 'retail',
    badge: 'Retail',
    title: 'Product Catalog & Order Storefront',
    subtitle: 'Category browsing, variant filters, shopping cart, and order tracking.',
    prompt:
      'Build a polished Product Catalog & Order Storefront with category filters, price sorting, product detail cards, interactive shopping cart, order placement form, and an admin order status tracker.',
  },
  {
    id: 'legal-case-docket',
    domain: 'legal',
    badge: 'Legal',
    title: 'Case Docket & Hearing Tracker',
    subtitle: 'Track court dates, client matters, filing deadlines, and status notes.',
    prompt:
      'Build a Legal Case Docket & Hearing Tracker for advocates and law firms to manage active matters, court names, upcoming hearing dates, filing deadlines with urgency badges, opposing counsel notes, and document checklists.',
  },
  {
    id: 'compliance-audit-checklist',
    domain: 'legal',
    badge: 'Legal',
    title: 'Compliance & Policy Audit Board',
    subtitle: 'Control checklists, risk ratings, owner sign-offs, and audit readiness score.',
    prompt:
      'Build a Compliance & Policy Audit Dashboard with categorized regulatory controls, Pass/At-Risk/Failed status toggles, remediation notes, owner assignment, overall compliance readiness percentage, and exportable audit report.',
  },
  {
    id: 'team-kanban-board',
    domain: 'operations',
    badge: 'Operations',
    title: 'Team Kanban & Sprint Board',
    subtitle: 'To-Do, In Progress, Review, and Done columns with priority tags.',
    prompt:
      'Build an interactive Team Kanban & Sprint Board with To-Do, In Progress, Review, and Done columns, priority badges, assignee filters, task detail editing, and persistent server storage.',
  },
  {
    id: 'hr-leave-shift-roster',
    domain: 'operations',
    badge: 'Operations',
    title: 'Employee Leave & Shift Roster',
    subtitle: 'Leave requests, manager approvals, shift calendar, and team availability.',
    prompt:
      'Build an Employee Leave & Shift Roster Manager where staff submit leave requests, managers approve or decline with 1 click, shift coverage displays on a weekly calendar grid, and remaining leave balances update automatically.',
  },
];
