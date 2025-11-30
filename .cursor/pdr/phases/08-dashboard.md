# Phase 8: Dashboard

**Status:** In Progress  
**Dependencies:** Phase 1, Phase 5  
**Estimated Time:** 5-6 days

## Overview

Build a Next.js dashboard with Clerk authentication, scan history, real-time updates, and credit management.

---

## 8.1 Dashboard Setup (`apps/dashboard`)

- [ ] Initialize Next.js project with Bun runtime
- [ ] Install dependencies:
  - `@clerk/nextjs` for authentication
  - `@safeurl/core` (workspace) for types
  - UI library (shadcn/ui or similar)
  - `zod` for form validation
- [ ] Configure Clerk authentication
- [ ] Set up API client for backend

### Project Structure

```
apps/dashboard/
├── package.json
├── tsconfig.json
├── next.config.js
├── app/
│   ├── layout.tsx
│   ├── page.tsx          # Dashboard home
│   ├── scans/
│   │   ├── page.tsx      # Scan list
│   │   └── [id]/
│   │       └── page.tsx  # Scan details
│   └── settings/
│       └── page.tsx
├── components/
│   ├── ui/               # shadcn components
│   ├── scans/
│   └── credits/
└── lib/
    ├── api.ts
    └── types.ts
```

---

## 8.2 Core Pages

### Dashboard Home

- [ ] **Scan History List**:
  - [ ] Fetch user's scan history from API
  - [ ] Display scans in table/list format
  - [ ] Show scan status, URL, risk score
  - [ ] Pagination support
  - [ ] Filter by status, date
- [ ] **Recent Scans Display**:
  - [ ] Show last 5-10 scans
  - [ ] Quick status indicators
  - [ ] Link to scan details
- [ ] **Credit Balance Widget**:
  - [ ] Display current credit balance
  - [ ] Show recent transactions
  - [ ] Link to purchase credits

### Scan Details Page

- [ ] **Display Scan Results**:
  - [ ] Fetch scan details from API
  - [ ] Show all scan metadata
  - [ ] Display risk assessment
- [ ] **Risk Score Visualization**:
  - [ ] Visual risk indicator (gauge, progress bar)
  - [ ] Color coding (red/yellow/green)
  - [ ] Risk level label
- [ ] **Categories and Indicators**:
  - [ ] Display threat categories
  - [ ] Show detected indicators
  - [ ] Visual category badges
- [ ] **Analysis Reasoning**:
  - [ ] Display agent's reasoning
  - [ ] Show analysis metadata
  - [ ] Format for readability

### Settings Page

- [ ] **API Key Management**:
  - [ ] Display existing API keys
  - [ ] Create new API key
  - [ ] Revoke API keys
  - [ ] Copy API key functionality
- [ ] **Credit Purchase**:
  - [ ] Display purchase options
  - [ ] Integrate payment flow (stub for now)
  - [ ] Show transaction history
- [ ] **Account Settings**:
  - [ ] User profile (via Clerk)
  - [ ] Notification preferences
  - [ ] Account deletion

---

## 8.3 Real-time Updates

### WebSocket or Polling

- [ ] **Scan Status Updates**:
  - [ ] Poll API for in-progress scans
  - [ ] Or use WebSocket for real-time updates
  - [ ] Update UI when status changes
- [ ] **Real-time Job Status Indicators**:
  - [ ] Show live status for queued scans
  - [ ] Update progress indicators
  - [ ] Show completion notifications
- [ ] **Progress Indicators**:
  - [ ] Show progress for in-progress scans
  - [ ] Display estimated completion time
  - [ ] Handle timeout scenarios

---

## 8.4 UI Components

### Scan Result Cards

- [ ] **Card Component**:
  - [ ] Display scan summary
  - [ ] Show risk score visually
  - [ ] Link to details page
  - [ ] Responsive design

### Risk Score Indicators

- [ ] **Visual Indicators**:
  - [ ] Color-coded badges
  - [ ] Progress bars
  - [ ] Icons for threat categories
- [ ] **Accessibility**:
  - [ ] ARIA labels
  - [ ] Screen reader support
  - [ ] Keyboard navigation

### Loading States

- [ ] **Skeleton Loaders**:
  - [ ] Show while fetching data
  - [ ] Match content layout
- [ ] **Spinner Components**:
  - [ ] For button actions
  - [ ] For page loads

### Error Handling UI

- [ ] **Error Messages**:
  - [ ] Display API errors
  - [ ] User-friendly error messages
  - [ ] Retry functionality
- [ ] **Empty States**:
  - [ ] No scans message
  - [ ] Empty history message
  - [ ] Call-to-action buttons

### Form Validation

- [ ] **Zod Schema Validation**:
  - [ ] Use schemas from `@safeurl/core`
  - [ ] Client-side validation
  - [ ] Display validation errors
- [ ] **Form Components**:
  - [ ] URL input with validation
  - [ ] Credit purchase form
  - [ ] API key creation form

---

## Success Criteria

- [ ] Dashboard displays scan history correctly
- [ ] Real-time updates work
- [ ] Authentication with Clerk works
- [ ] Credit management works
- [ ] Forms validate correctly
- [ ] UI is responsive and accessible
- [ ] Error handling is user-friendly
- [ ] All API calls use proper error handling

---

## Notes

- Use Next.js App Router
- Leverage Bun runtime for performance
- Keep UI components reusable
- Follow accessibility best practices
- Use TypeScript types from `@safeurl/core`
- Implement proper loading and error states
- Test with various screen sizes
