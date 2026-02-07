# Frontend Changelog v2.0

## [2026-02-06]

### Added
- **Guided AI Intake Flow:** Implemented a structured, step-by-step chat interaction.
- **System Message Role:** Added a dedicated `system` role to the chat interface.
- **Editable AI Drafts:** AI-generated drafts are now automatically loaded into the doctor's response area and can be manually edited.
- **Apply AI Draft Button:** Added a button to quickly reload the AI draft if the editor is cleared.
- **AI Consultation Sidebar:** Doctors can now open a sidebar to consult the AI about specific cases and "Apply to Editor" any useful AI-generated text.
- **Backend Refactor Guide v2.0:** Detailed the next steps for backend alignment with the guided intake flow.

### Changed
- **Improved Intake Data Display:** Updated `IntakeSummaryCard` to handle both camelCase and snake_case data from the backend.
- **Enhanced Payment Status:** The dashboard now correctly identifies PAID users even if Stripe logs are empty, by checking the conversation state (for dev/simulated payments).
- **PatientView State Management:** Tracks `intakeStep` and `intakeData` locally.
- **Doctor Dashboard Data Mapping:** Updated mapping for snake_case fields.
- **ChatMessage Component:** Enhanced to support the new `system` role.

### Fixed
- **Post-Payment Transition:** Fixed an issue where the AI would repeat the payment CTA.
- **Role Display:** Fixed system messages appearing as "You".
- **AI Draft Persona:** Updated the backend prompt to generate bold, clinical drafts (diagnosis + plan) for professional review, removing generic AI disclaimers.

