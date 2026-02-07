# Backend Refactor Guide

## Overview
To support the new "Master Prompt v2.3" and the "OSS AI Intake Prompt v1.0", the backend `system_ins.py` and chat view logic must be significantly updated. The current generic "Medical Advisory" prompt is insufficient for the strict state machine requirements.

## 1. System Prompt Update
Replace the content of `D:\OneDrive\Documents\repos\fettle_oss_backend\project\chatbot\system_ins.py` (or the equivalent file handling the system message) with the logic defined in `docs/MASTER_PROMPT_v2.3.md` and `docs/OSS AI intake prompt v1.0.md`.

**Key Logic to Implement:**
- **State Machine:** The backend must track the conversation mode (`general_education`, `payment_page`, `post_payment_intake`, `dermatologist_review`, `final_output`).
- **Strict Constraints:** In `general_education` mode, strictly FORBID diagnoses, drug names, and treatment plans.
- **Overrides:**
    - If user says "YES" -> Trigger `payment_page`.
    - If user says "DONE" (in intake) -> Trigger `dermatologist_review` and generate the **Doctor-Facing Review**.

## 2. Post-Payment Intake Logic
In `post_payment_intake` mode, the AI must explicitly ask for and extract:
1.  Duration
2.  Symptoms
3.  Location
4.  Medications Tried
5.  Prior Diagnoses
6.  Relevant Health History

**Action:** Update the backend to parse these fields from the conversation or guide the user to provide them one by one.

## 3. Auto-Draft Generation (Dermatologist Review)
When the mode transitions to `dermatologist_review`:
- The AI should **not** send a message to the user.
- Instead, it should generate a **Structured Review** for the doctor.
- **Fields to Generate:**
    - Differential Diagnoses
    - Qualified Diagnostic Terms
    - Morphology Reasoning
    - Educational Treatment Classes
    - Investigations Commonly Used
    - Red-Flag Interpretation
    - **Draft Message to Patient:** A compassionate, professional summary ready for the doctor to send.

## 4. Database Schema Updates
Ensure the `Conversation` model in the backend database has fields for:
- `intake_data` (JSON/JSONB): To store the structured intake fields.
- `doctor_draft` (Text): To store the AI-generated draft response.
- `doctor_internal_chat` (JSON/JSONB): To store the history of the Doctor <-> AI consultation.

## 5. API Endpoints
- **`POST /chat`**: Must handle the mode transitions and return the appropriate response based on the *current* mode.
- **`POST /doctor/chat`**: (New/Update) Endpoint for the doctor to chat with the AI about a specific patient case.
