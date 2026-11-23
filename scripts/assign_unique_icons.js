const fs = require('fs');
const lucide = require('lucide-react');

// The 73 OpenFilm Studio personas:
const studioIcons = {
  // motion_architecture
  '2D-to-3D Architectural Floor Plan': { icon: 'DraftingCompass', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'Solar Sun-Path & Ventilation Sim': { icon: 'SunMedium', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  'MEP & Structural X-Ray Layers': { icon: 'Layers', color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  'Interior Elevation & Kelvin Lab': { icon: 'LampCeiling', color: 'text-amber-200', bg: 'bg-amber-500/10' },

  // motion_drones
  'Multirotor TWR & Propulsion Lab': { icon: 'Fan', color: 'text-sky-300', bg: 'bg-sky-500/10' },
  'Drone SLAM & Waypoint Mission': { icon: 'Navigation2', color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  'Airfoil Lift, Stall & Vortex Lab': { icon: 'Wind', color: 'text-blue-300', bg: 'bg-blue-500/10' },

  // motion_civil_logistics
  'Bridge Truss Stress & Load Sim': { icon: 'Boxes', color: 'text-orange-300', bg: 'bg-orange-500/10' },
  'Supply & Cold-Chain Digital Twin': { icon: 'Truck', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Smart Traffic & EV Microgrid Flow': { icon: 'Car', color: 'text-teal-300', bg: 'bg-teal-500/10' },

  // motion_robotics
  '6-DOF Robotic Arm IK & Torque Lab': { icon: 'Bot', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Rover SLAM & LiDAR Maze Mapper': { icon: 'Radar', color: 'text-indigo-300', bg: 'bg-indigo-500/10' },
  'Factory Cell & PLC State Machine': { icon: 'Cog', color: 'text-slate-300', bg: 'bg-slate-500/10' },

  // motion_how_it_works
  'Engine & Drivetrain Cutaway Lab': { icon: 'Gauge', color: 'text-rose-300', bg: 'bg-rose-500/10' },
  'Gearbox, Hydraulics & Lever Lab': { icon: 'Wrench', color: 'text-slate-300', bg: 'bg-slate-500/10' },
  'Optics, Lens & Laser Ray-Tracing': { icon: 'Glasses', color: 'text-yellow-300', bg: 'bg-yellow-500/10' },
  'Inside Everyday Appliances & Tech': { icon: 'Microwave', color: 'text-purple-300', bg: 'bg-purple-500/10' },

  // motion_electronics
  'Circuit Simulator & Oscilloscope': { icon: 'Activity', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'CPU Pipeline & LLM AI Silicon': { icon: 'Cpu', color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  'Solar MPPT & EV Battery BMS Lab': { icon: 'BatteryCharging', color: 'text-amber-300', bg: 'bg-amber-500/10' },

  // motion_education
  'Physics Forces & Wave-Field Lab': { icon: 'Atom', color: 'text-blue-300', bg: 'bg-blue-500/10' },
  'Dynamic Math & Calculus Proofs': { icon: 'Spline', color: 'text-violet-300', bg: 'bg-violet-500/10' },
  'Chemistry Orbitals & Kinetics': { icon: 'FlaskConical', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Cellular Biology Micro-Journey': { icon: 'Dna', color: 'text-pink-300', bg: 'bg-pink-500/10' },
  'Algorithm & Recursion Tracer': { icon: 'Binary', color: 'text-cyan-300', bg: 'bg-cyan-500/10' },

  // motion_networks
  'DNS, TCP & TLS 1.3 Packet Journey': { icon: 'Network', color: 'text-teal-300', bg: 'bg-teal-500/10' },
  'K8s Autoscaling & Failover Sim': { icon: 'Server', color: 'text-blue-300', bg: 'bg-blue-500/10' },
  'Kill-Chain vs Zero-Trust Defense': { icon: 'ShieldAlert', color: 'text-red-400', bg: 'bg-red-500/10' },

  // motion_earth_space
  'Orbital & Hohmann Transfer Sim': { icon: 'Orbit', color: 'text-sky-300', bg: 'bg-sky-500/10' },
  'Tectonics, Cyclones & Clean Grid': { icon: 'Globe', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Standing Waves & Music Acoustics': { icon: 'Radio', color: 'text-amber-300', bg: 'bg-amber-500/10' },

  // motion_history_kids
  'Historical Atlas & Trade Timeline': { icon: 'Landmark', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'Kids Fractions & Phonics Play': { icon: 'Sparkles', color: 'text-pink-300', bg: 'bg-pink-500/10' },
  'Vedic Astronomy & Sundial Lab': { icon: 'Sun', color: 'text-orange-300', bg: 'bg-orange-500/10' },

  // motion_executive
  '3D Executive QBR & Revenue Deck': { icon: 'PieChart', color: 'text-purple-300', bg: 'bg-purple-500/10' },
  'Investor Pitch & Market Traction': { icon: 'TrendingUp', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Strategic Milestone Roadmap': { icon: 'Milestone', color: 'text-blue-300', bg: 'bg-blue-500/10' },

  // motion_productivity
  'Animated Workflow & SOP Replay': { icon: 'Workflow', color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  'SaaS Unit Economics & Runway Lab': { icon: 'Calculator', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Incident Postmortem & SLA Replay': { icon: 'History', color: 'text-rose-300', bg: 'bg-rose-500/10' },
  'Sprint Velocity & Gantt Timeline': { icon: 'Calendar', color: 'text-blue-300', bg: 'bg-blue-500/10' },

  // motion_kinetic
  'Kinetic Typography Manifesto': { icon: 'Type', color: 'text-yellow-300', bg: 'bg-yellow-500/10' },
  'Distributed Systems & API Flow': { icon: 'Share2', color: 'text-indigo-300', bg: 'bg-indigo-500/10' },
  'Book & Mental-Model Summary': { icon: 'BookOpen', color: 'text-amber-300', bg: 'bg-amber-500/10' },

  // motion_product
  'Dark-Mode SaaS Hero Launch': { icon: 'Rocket', color: 'text-violet-300', bg: 'bg-violet-500/10' },
  'Live Animated Analytics Dashboard': { icon: 'BarChart3', color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  '3D Mobile App UX Showcase': { icon: 'Smartphone', color: 'text-sky-300', bg: 'bg-sky-500/10' },

  // motion_creative
  'Procedural Watercolor & Wash Art': { icon: 'Palette', color: 'text-pink-300', bg: 'bg-pink-500/10' },
  '3B1B Math & Geometric Animation': { icon: 'Sigma', color: 'text-indigo-300', bg: 'bg-indigo-500/10' },
  'Traditional Ink Wash & Chinese Painting': { icon: 'Brush', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  '2D Rigged Character Walk-Cycle': { icon: 'UserCheck', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Pencil Sketch to Ink Line Reveal': { icon: 'Pencil', color: 'text-slate-300', bg: 'bg-slate-500/10' },
  'Cartoon Storyboard & Comic': { icon: 'Film', color: 'text-rose-300', bg: 'bg-rose-500/10' },
  'Sacred Geometry & Perspective': { icon: 'Compass', color: 'text-purple-300', bg: 'bg-purple-500/10' },

  // motion_media
  'Brand Intro & 3D Logo Stinger': { icon: 'Clapperboard', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'Vertical 9:16 Kinetic Social Reel': { icon: 'Video', color: 'text-pink-300', bg: 'bg-pink-500/10' },
  'Playwright 60fps MP4 Video Exporter': { icon: 'Tv', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },

  // motion_medical
  'Disease & Anatomical Progression': { icon: 'HeartPulse', color: 'text-rose-400', bg: 'bg-rose-500/10' },
  'ECG, Lab Panel & Spirometry': { icon: 'Stethoscope', color: 'text-red-300', bg: 'bg-red-500/10' },
  'Drug Mechanism of Action (MoA)': { icon: 'Pill', color: 'text-teal-300', bg: 'bg-teal-500/10' },
  'Surgical, Inhaler & CPR Trainer': { icon: 'Syringe', color: 'text-sky-300', bg: 'bg-sky-500/10' },

  // motion_wellness
  'Exercise Form & Joint Angle Lab': { icon: 'Dumbbell', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Yoga Asana Flow & Breath Pacer': { icon: 'Flower2', color: 'text-teal-300', bg: 'bg-teal-500/10' },
  'Metabolic Calorie & Macro Plate': { icon: 'Apple', color: 'text-lime-300', bg: 'bg-lime-500/10' },
  'Desk Rehab & Meal Glycemic Curve': { icon: 'Flame', color: 'text-orange-300', bg: 'bg-orange-500/10' },

  // motion_home
  'Room Layout & Festive Makeover': { icon: 'Armchair', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'Weekly Family Meal & Pantry Plan': { icon: 'Utensils', color: 'text-orange-300', bg: 'bg-orange-500/10' },
  'Wardrobe & Kitchen Decluttering': { icon: 'Shirt', color: 'text-purple-300', bg: 'bg-purple-500/10' },
  'Balcony Garden & Home Budget': { icon: 'Leaf', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },

  // motion_elderly
  'Large-Print Medicine & Water': { icon: 'Droplets', color: 'text-blue-300', bg: 'bg-blue-500/10' },
  'Smartphone & UPI Safety Tutor': { icon: 'PhoneCall', color: 'text-teal-300', bg: 'bg-teal-500/10' },
  'Chair Physio & Joint Mobility': { icon: 'Smile', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Elder Fraud & OTP Scam Shield': { icon: 'UserX', color: 'text-rose-400', bg: 'bg-rose-500/10' }
};

// The 67 Chat personas:
const chatIcons = {
  // Coding / Tech
  'Code Review Pass': { icon: 'GitPullRequest', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'API Architecture': { icon: 'Network', color: 'text-teal-300', bg: 'bg-teal-500/10' },
  'Async Task Queue': { icon: 'Layers', color: 'text-indigo-300', bg: 'bg-indigo-500/10' },
  'SQL Query Tuning': { icon: 'Database', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'Backprop for Attention': { icon: 'BrainCircuit', color: 'text-purple-300', bg: 'bg-purple-500/10' },
  'Binary Search Coach': { icon: 'Binary', color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  'Architecture Diagram': { icon: 'DraftingCompass', color: 'text-sky-300', bg: 'bg-sky-500/10' },
  'Data Anomaly Audit': { icon: 'BarChart2', color: 'text-rose-300', bg: 'bg-rose-500/10' },
  'Security Code Review': { icon: 'ShieldAlert', color: 'text-red-400', bg: 'bg-red-500/10' },
  'Dijkstra vs A*': { icon: 'GitFork', color: 'text-blue-300', bg: 'bg-blue-500/10' },
  'Python from Zero': { icon: 'Terminal', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Kirchhoff Circuit Walkthrough': { icon: 'Zap', color: 'text-yellow-300', bg: 'bg-yellow-500/10' },

  // Suggested / Live Feeds
  'Gold, Silver & Fuel': { icon: 'Coins', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'AI Model Releases': { icon: 'Bot', color: 'text-purple-300', bg: 'bg-purple-500/10' },
  'Govt & Court Roundup': { icon: 'Scale', color: 'text-amber-200', bg: 'bg-amber-500/10' },
  'Disaster & Weather Alerts': { icon: 'AlertTriangle', color: 'text-red-400', bg: 'bg-red-500/10' },
  'Market Wrap': { icon: 'TrendingUp', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Health & AQI Bulletin': { icon: 'HeartPulse', color: 'text-rose-400', bg: 'bg-rose-500/10' },
  'Rail, Flight & Road Status': { icon: 'Train', color: 'text-sky-300', bg: 'bg-sky-500/10' },
  'Policy Research Audit': { icon: 'FileSearch', color: 'text-indigo-300', bg: 'bg-indigo-500/10' },
  'Vault Knowledge Query': { icon: 'ShieldCheck', color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  'First-Principles Explainer': { icon: 'Lightbulb', color: 'text-yellow-300', bg: 'bg-yellow-500/10' },

  // Math & STEM
  'CBSE / IGCSE Chapter Tutor': { icon: 'GraduationCap', color: 'text-blue-300', bg: 'bg-blue-500/10' },
  'Textbook Navigator': { icon: 'BookOpen', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'PRD from Requirement': { icon: 'FileSpreadsheet', color: 'text-teal-300', bg: 'bg-teal-500/10' },
  'EMI Problem Walkthrough': { icon: 'Calculator', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Wave-Particle Duality': { icon: 'Waves', color: 'text-violet-300', bg: 'bg-violet-500/10' },
  'Thermodynamics Quiz': { icon: 'Flame', color: 'text-orange-300', bg: 'bg-orange-500/10' },
  'Differential Equation Walkthrough': { icon: 'Variable', color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  'Quadratic Formula Derivation': { icon: 'Sigma', color: 'text-indigo-300', bg: 'bg-indigo-500/10' },
  'Newton\'s Laws': { icon: 'Atom', color: 'text-blue-300', bg: 'bg-blue-500/10' },

  // Sovereign / Offline
  'On-Device Deck': { icon: 'Presentation', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Offline Document Review': { icon: 'FileCheck', color: 'text-teal-300', bg: 'bg-teal-500/10' },
  'Private Strategy Draft': { icon: 'Lock', color: 'text-purple-300', bg: 'bg-purple-500/10' },
  'Local PDF Summary': { icon: 'FileText', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'Private Image Analysis': { icon: 'Scan', color: 'text-pink-300', bg: 'bg-pink-500/10' },

  // Floor plan & 3D
  'Room Reconstruction': { icon: 'Box', color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  'Living & Study Studio': { icon: 'Lamp', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'Whole Floor Plan Integration': { icon: 'Building2', color: 'text-orange-300', bg: 'bg-orange-500/10' },
  'Indoor Virtual Walkthrough (WASD)': { icon: 'Footprints', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Ready-Made 1,400 sq ft 3BHK Vastu Villa': { icon: 'Home', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  '30 × 40 ft Independent Duplex House': { icon: 'Building', color: 'text-teal-300', bg: 'bg-teal-500/10' },
  'Vastu & Solar Daylighting Audit': { icon: 'SunMedium', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  '3D Architectural Walkthrough': { icon: 'Eye', color: 'text-sky-300', bg: 'bg-sky-500/10' },

  // Study & Learning
  'Make a Study Book': { icon: 'BookMarked', color: 'text-violet-300', bg: 'bg-violet-500/10' },
  'Test My Knowledge (Quiz Me!)': { icon: 'HelpCircle', color: 'text-pink-300', bg: 'bg-pink-500/10' },
  'Explain Like I\'m 10': { icon: 'Smile', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'My Study Notes & Summary': { icon: 'FileSignature', color: 'text-blue-300', bg: 'bg-blue-500/10' },
  'Essay & Letter Helper': { icon: 'PenTool', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },

  // Family & Wellness
  'Daily Gentle Yoga & Stretching': { icon: 'Activity', color: 'text-teal-300', bg: 'bg-teal-500/10' },
  'Nutritious Family Meal Plan': { icon: 'Apple', color: 'text-lime-300', bg: 'bg-lime-500/10' },
  'Medicine Safety & Interaction Check': { icon: 'Pill', color: 'text-rose-300', bg: 'bg-rose-500/10' },
  'Joint & Back Comfort Guide': { icon: 'Stethoscope', color: 'text-sky-300', bg: 'bg-sky-500/10' },

  // Vedic
  'Today\'s Panchang & Auspicious Timings': { icon: 'Sun', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  'Upcoming Festivals & Vrats': { icon: 'Calendar', color: 'text-orange-300', bg: 'bg-orange-500/10' },
  'Shubh Muhurat Finder': { icon: 'Compass', color: 'text-yellow-300', bg: 'bg-yellow-500/10' },

  // DIY & Maker
  'Smart Arduino / ESP32 Project': { icon: 'Cpu', color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  'Home Appliance & DIY Fix': { icon: 'Wrench', color: 'text-slate-300', bg: 'bg-slate-500/10' },

  // Office & Living
  'Formal Letter & Application Writer': { icon: 'Mail', color: 'text-sky-300', bg: 'bg-sky-500/10' },
  'Explain My Bill or Statement': { icon: 'FileQuestion', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'Magical Bedtime Story': { icon: 'Moon', color: 'text-indigo-300', bg: 'bg-indigo-500/10' },
  'Family & Home Budget Tracker': { icon: 'PiggyBank', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Grocery & Kitchen Inventory': { icon: 'ShoppingCart', color: 'text-teal-300', bg: 'bg-teal-500/10' },
  'Small Business Sales & Expense Sheet': { icon: 'Receipt', color: 'text-purple-300', bg: 'bg-purple-500/10' },
  'Formal Letter & Application': { icon: 'Send', color: 'text-blue-300', bg: 'bg-blue-500/10' },

  // 3D & Showcase
  '3D Science Explainer': { icon: 'Clapperboard', color: 'text-violet-300', bg: 'bg-violet-500/10' },
  '3D Product & Tech Showcase': { icon: 'Rocket', color: 'text-rose-300', bg: 'bg-rose-500/10' }
};

// The 96 Landing personas:
const landingIcons = {
  // office_sheets
  'Family & Home Budget Tracker': { icon: 'PiggyBank', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Multi-Year Financial Forecast & DCF Model': { icon: 'LineChart', color: 'text-teal-300', bg: 'bg-teal-500/10' },
  'Weekly Grocery & Kitchen Inventory': { icon: 'ShoppingCart', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'Small Business Revenue & Expense Sheet': { icon: 'Receipt', color: 'text-purple-300', bg: 'bg-purple-500/10' },
  'Supply Chain & Inventory Restock Model': { icon: 'PackageCheck', color: 'text-sky-300', bg: 'bg-sky-500/10' },
  'Student Study Timetable & Grade Tracker': { icon: 'CalendarDays', color: 'text-blue-300', bg: 'bg-blue-500/10' },

  // office_analytics
  'Statistical Data & Outlier Analysis': { icon: 'ScatterChart', color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  'Executive KPI Dashboard & Gantt Flow': { icon: 'BarChart2', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },

  // office_docs
  'Formal Letter & Application Writer': { icon: 'MailCheck', color: 'text-sky-300', bg: 'bg-sky-500/10' },
  'Residential Society Notice & Circular': { icon: 'Megaphone', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'Bank Account Transfer & KYC Update Request': { icon: 'Landmark', color: 'text-indigo-300', bg: 'bg-indigo-500/10' },
  'Standard House Rental Agreement Draft': { icon: 'FileSignature', color: 'text-teal-300', bg: 'bg-teal-500/10' },

  // office_knowledge
  'Compile Polished Multi-Format Document': { icon: 'BookCopy', color: 'text-purple-300', bg: 'bg-purple-500/10' },
  'LanceDB Isolated Vector Search & Citations': { icon: 'DatabaseZap', color: 'text-cyan-300', bg: 'bg-cyan-500/10' },

  // office_files
  'Inspect & Manage Shared Document Folder': { icon: 'FolderTree', color: 'text-amber-300', bg: 'bg-amber-500/10' },

  // stories_creative
  'Magical Bedtime Story': { icon: 'Sparkle', color: 'text-indigo-300', bg: 'bg-indigo-500/10' },
  'Plain-English Bill & PDF Breakdown': { icon: 'FileText', color: 'text-rose-300', bg: 'bg-rose-500/10' },

  // architect_plans
  'Residential Floor Plan Planner': { icon: 'Grid', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'Sun-Path, Daylight & Ventilation Audit': { icon: 'SunDim', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },

  // scenemosaic_rooms
  'Photo to 3D Room Reconstruction': { icon: 'ScanFace', color: 'text-sky-300', bg: 'bg-sky-500/10' },

  // maker_diy
  'Smart Arduino / ESP32 Project': { icon: 'CircuitBoard', color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  'Home Appliance & Safe Repair Guide': { icon: 'Hammer', color: 'text-slate-300', bg: 'bg-slate-500/10' },

  // markets_finance
  'Market Overview': { icon: 'CandlestickChart', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Bullion Desk': { icon: 'Coins', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'Equity Dossier': { icon: 'Briefcase', color: 'text-teal-300', bg: 'bg-teal-500/10' },
  'DeFi Contract Review': { icon: 'ShieldCheck', color: 'text-purple-300', bg: 'bg-purple-500/10' },

  // family_health
  'Generic Medicine Prices': { icon: 'BadgePercent', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Clinical DDx Workup': { icon: 'ClipboardCheck', color: 'text-rose-300', bg: 'bg-rose-500/10' },
  'Drug Interaction Check': { icon: 'Pill', color: 'text-teal-300', bg: 'bg-teal-500/10' },
  'Emergency & AQI Triage': { icon: 'AlertOctagon', color: 'text-red-400', bg: 'bg-red-500/10' },

  // vedic_wellness
  'Panchang & Muhurta': { icon: 'Sunrise', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  'Ayurvedic Daily Regimen': { icon: 'LeafyGreen', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Festival Calendar & Vrats': { icon: 'CalendarHeart', color: 'text-orange-300', bg: 'bg-orange-500/10' },
  'Yoga & Pranayama Plan': { icon: 'HeartHandshake', color: 'text-teal-300', bg: 'bg-teal-500/10' },
  'WCAG Contrast Audit': { icon: 'Contrast', color: 'text-purple-300', bg: 'bg-purple-500/10' },

  // citizen_essentials
  'Fuel & LPG Prices': { icon: 'Fuel', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  'Water & Food Safety': { icon: 'GlassWater', color: 'text-sky-300', bg: 'bg-sky-500/10' },
  'School Orders & Exams': { icon: 'GraduationCap', color: 'text-blue-300', bg: 'bg-blue-500/10' },
  'Banking & EPFO Help': { icon: 'Building', color: 'text-indigo-300', bg: 'bg-indigo-500/10' },
  'Transit & Route Alerts': { icon: 'Bus', color: 'text-teal-300', bg: 'bg-teal-500/10' },

  // governance_law
  'RBI Compliance Check': { icon: 'Scale', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'Case Law & Gazette': { icon: 'ScrollText', color: 'text-slate-300', bg: 'bg-slate-500/10' },
  'ISO 27001 / SOC 2 Audit': { icon: 'Shield', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Contract Clause Review': { icon: 'FileSearch', color: 'text-cyan-300', bg: 'bg-cyan-500/10' },

  // geopolitics_intel
  'Border & Defence Brief': { icon: 'ShieldAlert', color: 'text-red-400', bg: 'bg-red-500/10' },
  'Critical Minerals Map': { icon: 'Gem', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'Alliance & Sanctions Map': { icon: 'Globe2', color: 'text-blue-300', bg: 'bg-blue-500/10' },
  'State Cyber Threat Brief': { icon: 'RadioTower', color: 'text-purple-300', bg: 'bg-purple-500/10' },

  // security_hardware
  'CVE Threat Brief': { icon: 'BugOff', color: 'text-rose-400', bg: 'bg-rose-500/10' },
  'GPU Cluster Comparison': { icon: 'Cpu', color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  'Edge Vision Architecture': { icon: 'ScanEye', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Code & Secret Scan': { icon: 'KeyRound', color: 'text-amber-300', bg: 'bg-amber-500/10' },

  // study_core
  'Symbolic Math Solver': { icon: 'Binary', color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  'Pedagogical Algebra Coach': { icon: 'Calculator', color: 'text-blue-300', bg: 'bg-blue-500/10' },
  'Offline Interactive STEM Lab': { icon: 'TestTube', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Visual Concept & Animated Physics Lab': { icon: 'Magnet', color: 'text-violet-300', bg: 'bg-violet-500/10' },
  'Concept Book Builder': { icon: 'BookMarked', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'Derivation Coach': { icon: 'Sigma', color: 'text-indigo-300', bg: 'bg-indigo-500/10' },
  'Academic Literature Preview': { icon: 'Award', color: 'text-purple-300', bg: 'bg-purple-500/10' },
  'Algorithm Comparison': { icon: 'GitBranch', color: 'text-teal-300', bg: 'bg-teal-500/10' },

  // school_boards
  'CBSE Chapter Tutor': { icon: 'School', color: 'text-blue-300', bg: 'bg-blue-500/10' },
  'IGCSE Topic Tutor': { icon: 'Compass', color: 'text-teal-300', bg: 'bg-teal-500/10' },
  'IB DP Science & Math Coach': { icon: 'Infinity', color: 'text-violet-300', bg: 'bg-violet-500/10' },
  'Chemistry Equation & Stoichiometry Lab': { icon: 'Beaker', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Board Exam Drill': { icon: 'FileQuestion', color: 'text-orange-300', bg: 'bg-orange-500/10' },
  'Book-Back Exercise Solver': { icon: 'CheckSquare', color: 'text-sky-300', bg: 'bg-sky-500/10' },
  'Doubt Clinic': { icon: 'HelpCircle', color: 'text-pink-300', bg: 'bg-pink-500/10' },
  'Formula Flashcards': { icon: 'Layers2', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'Biology & Living Systems Visual Lab': { icon: 'Microscope', color: 'text-lime-300', bg: 'bg-lime-500/10' },
  'Concept Gap Diagnostic': { icon: 'ActivitySquare', color: 'text-rose-300', bg: 'bg-rose-500/10' },

  // textbook_navigator
  'Textbook Page Guide': { icon: 'BookOpen', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'Homework Helper': { icon: 'PenLine', color: 'text-sky-300', bg: 'bg-sky-500/10' },
  'Chapter Summary & Map': { icon: 'Map', color: 'text-teal-300', bg: 'bg-teal-500/10' },
  'Exercise Answer Bank': { icon: 'ListChecks', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Multi-Source Concept Explainer & Video Hub': { icon: 'Presentation', color: 'text-purple-300', bg: 'bg-purple-500/10' },

  // python_from_zero
  'Python Lesson': { icon: 'Code2', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Python Course Map': { icon: 'Milestone', color: 'text-blue-300', bg: 'bg-blue-500/10' },
  'Python Practice Set': { icon: 'TerminalSquare', color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  'Python Debug Coach': { icon: 'Bug', color: 'text-rose-300', bg: 'bg-rose-500/10' },
  'Python Quiz': { icon: 'CheckCircle2', color: 'text-violet-300', bg: 'bg-violet-500/10' },
  'Python Mini-Project': { icon: 'Boxes', color: 'text-amber-300', bg: 'bg-amber-500/10' },

  // ai_research_books
  'Deep Research Dossier': { icon: 'SearchCode', color: 'text-indigo-300', bg: 'bg-indigo-500/10' },
  'PhD Thesis & Defense Synthesizer': { icon: 'Scroll', color: 'text-amber-300', bg: 'bg-amber-500/10' },
  'Advanced Theoretical Physics & Math Lab': { icon: 'Atom', color: 'text-blue-300', bg: 'bg-blue-500/10' },
  'Robotics Kinematics & Embedded Hardware Lab': { icon: 'Bot', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'E-Book Blueprint': { icon: 'BookUp', color: 'text-violet-300', bg: 'bg-violet-500/10' },
  'Transformer Sizing': { icon: 'Layers', color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  'Peer-Reviewed Survey': { icon: 'FileSpreadsheet', color: 'text-teal-300', bg: 'bg-teal-500/10' },

  // vibecoding_dev
  'API Architecture Blueprint': { icon: 'Network', color: 'text-teal-300', bg: 'bg-teal-500/10' },
  'Plan Execution Audit': { icon: 'CheckCheck', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'UI Component Build': { icon: 'Component', color: 'text-violet-300', bg: 'bg-violet-500/10' },
  'Query Performance Review': { icon: 'Zap', color: 'text-amber-300', bg: 'bg-amber-500/10' },

  // privacy_vault
  'Offline Document Build': { icon: 'FileCheck2', color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  'Vault Search': { icon: 'FolderSearch', color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  'Confidential Strategy': { icon: 'LockKeyhole', color: 'text-purple-300', bg: 'bg-purple-500/10' },
  'Forensic Document Audit': { icon: 'Fingerprint', color: 'text-rose-400', bg: 'bg-rose-500/10' }
};

// Validate all icons exist in lucide-react
let missing = [];
for (const [t, entry] of Object.entries(studioIcons)) {
  if (!lucide[entry.icon]) missing.push(['studio', t, entry.icon]);
}
for (const [t, entry] of Object.entries(chatIcons)) {
  if (!lucide[entry.icon]) missing.push(['chat', t, entry.icon]);
}
for (const [t, entry] of Object.entries(landingIcons)) {
  if (!lucide[entry.icon]) missing.push(['landing', t, entry.icon]);
}

console.log('Missing Lucide exports:', missing);
console.log('Studio count:', Object.keys(studioIcons).length);
console.log('Chat count:', Object.keys(chatIcons).length);
console.log('Landing count:', Object.keys(landingIcons).length);

module.exports = { studioIcons, chatIcons, landingIcons };
