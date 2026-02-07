# Changelog

## [Unreleased] - 2026-02-03

### Added
- **Medical Case Summary (Doctor View):** A structured "Neat Format" display for patient intake data (Duration, Symptoms, Location, Meds, History).
- **AI-Drafted Response:** Automatically generates a draft response for the doctor to review after patient intake is complete.
- **Doctor-AI Consultation Mode:** A dedicated interface for doctors to discuss the case with the AI before sending a response.
- **Backend Refactor Guide:** `BACKEND_REFACTOR.md` detailed instructions for aligning the backend with the new Master Prompt v2.3.

### Changed
- **Intake Data Structure:** Updated `IntakeData` type to strictly match the required fields: `duration`, `symptoms`, `location`, `medicationsTried`, `priorDiagnoses`, `relevantHealthHistory`.
- **Doctor Chat View:** Overhauled to include the Intake Summary and AI tools.
- **Chat Logic:** Enhanced `useAIChat` to support the transition to Doctor Review and simulated draft generation.

### Fixed
- Addressed UI/UX gaps in the doctor dashboard for a more professional and efficient workflow.
