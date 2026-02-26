// Conversation modes (state machine)
export type ConversationMode =
  | 'general_education'
  | 'payment_page'
  | 'post_payment_intake'
  | 'dermatologist_review'
  | 'final_output';

// Message roles
export type MessageRole = 'patient' | 'ai' | 'doctor';

// Message interface
export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  images?: string[]; // S3 URLs
  timestamp: Date;
  isVisible: boolean; // For doctor internal notes
  senderName?: string; // Original sender name/email from API
}

// Conversation interface
export interface Conversation {
  id: string;
  patient_id?: string; // Add patient_id to link back to UserModel
  patientEmail: string;
  patientName: string;
  mode: ConversationMode;
  paymentStatus: 'unpaid' | 'paid';
  status: 'active' | 'completed';
  // createdAt: Date;
  // updatedAt: Date;
  intakeData?: IntakeData;
  doctorNotes?: string; // Internal notes (not visible to patient)
  draftResponse?: string; // AI-generated draft for doctor review
}

// Intake data collected post-payment
export interface IntakeData {
  duration: string;
  symptoms: string;
  location: string;
  medicationsTried: string;
  priorDiagnoses: string;
  relevantHealthHistory: string;
  images: string[]; // Base64 preview URLs
}

// User types
export type UserRole = 'patient' | 'doctor';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

// Auth context
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Doctor credentials (dummy)
export const DOCTOR_CREDENTIALS = {
  email: 'doctor@test.com',
  password: 'doctor123',
};

// Consultation price
export const CONSULTATION_PRICE = 49;

// Initial disclaimer
export const DISCLAIMER = `⚠️ IMPORTANT DISCLAIMER

This AI Educational Assistant provides general dermatological information for educational purposes ONLY. It is NOT a substitute for professional medical advice, diagnosis, or treatment.

This assistant CANNOT and WILL NOT:
• Diagnose any skin condition
• Prescribe medications or treatments
• Provide personalized medical advice

For professional medical evaluation and diagnosis, please consider our paid consultation service ($${CONSULTATION_PRICE}) where Dr. Attili will review your case.

By continuing, you acknowledge that you understand these limitations.`;
