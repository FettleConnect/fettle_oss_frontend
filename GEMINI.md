# Project Context: Fettle OSS Frontend

## Overview
This project is the frontend for "Fettle OSS", an AI-powered dermatology educational assistant. It facilitates interactions between patients and an AI agent, with the ability to escalate to a paid consultation with a human dermatologist (Dr. Sasi Kiran Attili). The application features distinct, responsive portals for patients and doctors.

## Tech Stack
*   **Framework:** React 18 + Vite 5
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS, shadcn/ui (Radix Primitives), Lucide React (Icons)
*   **State Management:**
    *   Global/Local Sync: Custom in-memory store with `localStorage` persistence (`src/store/dataStore.ts`)
    *   Server State: `@tanstack/react-query`
*   **Routing:** `react-router-dom`
*   **Backend Integration:**
    *   Primary API: `axios` to `http://localhost:8000` (Defined in `src/base_url.tsx`)
    *   Supabase: Configured for Authentication (Magic Links) and Client services.
*   **Authentication:**
    *   **Patient:** Dual-Mode (Google OAuth + Supabase Magic Link Email Login).
    *   **Doctor:** Custom Credentials + Backend Token Validation (`DoctorToken`).
*   **Payments:** PayPal JS SDK (`@paypal/react-paypal-js`) configured for **USD** ($49).
*   **Content Rendering:** `react-markdown` for bold and structured clinical responses.

## Key Scripts
*   `npm run dev`: Start the development server (default port 8080).
*   `npm run build`: Build for production.
*   `npx playwright test`: Run end-to-end automated verification suite.

## Architecture & Conventions

### Directory Structure
*   `src/components/auth/`: Login components including `GoogleLogin` (with Magic Link support).
*   `src/components/chat/`: Core chat UI with Markdown support and Auto-Focus logic.
*   `src/components/doctor/`: Multi-consultation dashboard with unread tagging and AI review assistant.
*   `src/components/patient/`: Patient view with responsive history sidebar (drawers on mobile).
*   `src/store/dataStore.ts`: Local persistence for session management.

### Domain Logic
The application follows a state-managed consultation lifecycle:
1.  `general_education`: AI educational chat.
2.  `payment_page`: User prompted to pay $49 via PayPal.
3.  `post_payment_intake`: 6-step guided clinical intake.
4.  `dermatologist_review`: Doctor reviewing case with AI-generated clinical drafts.
5.  `final_output`: Final diagnostic/advice delivered.

### New Features (v2.0)
- **Responsive Design**: Full mobile support with toggleable drawers for history and patient lists.
- **Consultation Archiving**: Both patients and doctors can manually archive sessions to start new ones.
- **AI-Generated Naming**: Archived chats are automatically summarized into descriptive titles.
- **Clinical Persona**: Post-payment AI strips educational disclaimers for professional technical advice.
- **Email Magic Links**: Seamless passwordless login via Supabase.