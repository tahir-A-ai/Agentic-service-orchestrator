/**
 * Mock data for UI components that need demo content.
 * Used for: chat history sidebar, provider dashboard, demo jobs.
 * Kept separate from components — components accept props, never import this directly.
 */

/* ── Chat history (sidebar) ──────────────────── */

export const mockChatHistory = [
  {
    id: 'sess-1',
    title: 'G-13 bijli wala',
    preview: 'Electrician booking — 2 candidates found',
    timeAgo: '2 min ago',
  },
  {
    id: 'sess-2',
    title: 'AC service G-11',
    preview: 'AC Technician — booking confirmed',
    timeAgo: '1 hr ago',
  },
  {
    id: 'sess-3',
    title: 'Nalqe wala F-10',
    preview: 'Plumber — 3 options found',
    timeAgo: '2 days ago',
  },
];

/* ── Islamabad sectors ───────────────────────── */

export const islamabadSectors = [
  'G-5', 'G-6', 'G-7', 'G-8', 'G-9', 'G-10', 'G-11', 'G-13', 'G-14', 'G-15',
  'F-5', 'F-6', 'F-7', 'F-8', 'F-10', 'F-11',
  'E-7', 'E-11',
  'H-8', 'H-9', 'H-13',
  'I-8', 'I-9', 'I-10', 'I-14', 'I-16',
  'Blue Area', 'Bahria Town', 'DHA',
];

/* ── Provider Dashboard: Mock jobs ───────────── */

export const mockActiveJobs = [
  {
    id: 'job-1',
    customerSector: 'G-13/4',
    serviceType: 'Electrician',
    status: 'In Progress',
    bookedAt: '2026-06-24T09:15:00Z',
    notes: 'Main switch board ka issue hai. Customer: Tahir.',
    sessionId: 'abc-123',
  },
  {
    id: 'job-2',
    customerSector: 'G-11/3',
    serviceType: 'Electrician',
    status: 'New',
    bookedAt: '2026-06-24T10:30:00Z',
    notes: 'Ceiling fan install karna hai.',
    sessionId: 'def-456',
  },
  {
    id: 'job-3',
    customerSector: 'E-11/2',
    serviceType: 'Electrician',
    status: 'New',
    bookedAt: '2026-06-24T11:00:00Z',
    notes: 'Generator wiring check karna hai.',
    sessionId: 'ghi-789',
  },
];

export const mockCompletedJobs = [
  {
    id: 'job-c1',
    customerSector: 'G-13/1',
    serviceType: 'Electrician',
    status: 'Completed',
    bookedAt: '2026-06-22T14:00:00Z',
    completedAt: '2026-06-22T15:30:00Z',
    duration: '1.5 hrs',
    notes: 'UPS installation aur wiring fix.',
  },
  {
    id: 'job-c2',
    customerSector: 'F-8/3',
    serviceType: 'Electrician',
    status: 'Completed',
    bookedAt: '2026-06-21T09:00:00Z',
    completedAt: '2026-06-21T10:00:00Z',
    duration: '1 hr',
    notes: 'Short circuit fix kiya.',
  },
];

/* ── Provider Dashboard: Stats ───────────────── */

export const mockProviderStats = {
  activeJobs: 3,
  completedJobs: 47,
  rating: 4.8,
};

/* ── Provider profile (for dashboard demo) ───── */

export const mockProviderProfile = {
  name: 'Tariq Mehmood',
  email: 'tariq@example.com',
  phone: '03001234567',
  serviceType: 'Electrician',
  sector: 'G-13',
  experience: 8,
  bio: 'Bijli ka kaam 8 saal se kar raha hoon. Islamabad mein har tarah ka electrical kaam karta hoon.',
};
