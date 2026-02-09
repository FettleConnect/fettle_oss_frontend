# Fettle OSS Frontend 🩺

Fettle is an AI-powered teledermatology platform designed to bridge the gap between general skin health education and professional clinical consultation. This repository contains the **React + Vite** frontend, featuring responsive portals for both patients and healthcare providers.

## 🚀 Features

- **Dual-Mode AI Assistant**: Seamlessly transitions from general educational chat to high-precision clinical intake post-payment.
- **Guided Clinical Intake**: A structured 6-step AI-led process to collect symptoms, history, and imagery.
- **Doctor Dashboard**: A comprehensive multi-consultation interface with:
  - Real-time unread tagging (Blue dot indicators).
  - Absolute recency sorting (Activity-based ordering).
  - AI-led peer review assistant for drafting responses.
- **Flexible Authentication**: Support for both **Google OAuth** and **Supabase Magic Link** (passwordless email login).
- **Secure Payments**: Integrated **PayPal SDK** localized for **INR** (₹499) with server-side integrity verification.
- **Mobile First**: Fully responsive design utilizing slide-out drawers for history and patient management on smaller viewports.
- **Markdown Support**: Rich rendering of clinical assessments and diagnostic plans.

## 🛠️ Tech Stack

- **Framework**: React 18 + Vite 5
- **Styling**: Tailwind CSS + shadcn/ui (Radix Primitives)
- **State Management**: React Query (Server State) + Custom Persistence Store
- **Auth**: Google OAuth + Supabase Auth
- **Icons**: Lucide React
- **Verification**: Playwright E2E Testing Suite

## 📦 Getting Started

1. **Clone & Install**:
   ```bash
   npm install
   ```

2. **Environment Setup**:
   Create a `.env` file with the following:
   ```bash
   VITE_SUPABASE_URL=your_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_key
   VITE_PAYPAL_CLIENT_ID=your_paypal_id
   ```

3. **Development**:
   ```bash
   npm run dev
   ```

4. **Test**:
   ```bash
   npx playwright test
   ```

## 📄 License
MIT