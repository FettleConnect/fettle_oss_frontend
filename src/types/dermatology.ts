// Conversation modes (state machine)
export type ConversationMode =
  | 'general_education'
  | 'payment_page'
  | 'post_payment_intake'
  | 'dermatologist_review'
  | 'final_output';

// Message roles
export type MessageRole = 'patient' | 'ai' | 'doctor' | 'system';

// Message interface
export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  images?: string[];
  timestamp: Date;
  isVisible: boolean;
  senderName?: string;
}

// Conversation interface
export interface Conversation {
  id: string;
  patient_id?: string;
  patientEmail: string;
  patientName: string;
  mode: ConversationMode;
  paymentStatus: 'unpaid' | 'paid';
  status: 'active' | 'completed';
  intakeData?: IntakeData;
  doctorNotes?: string;
  draftResponse?: string;
}

// Intake data collected post-payment
export interface IntakeData {
  duration: string;
  symptoms: string;
  location: string;
  medicationsTried: string;
  priorDiagnoses: string;
  relevantHealthHistory: string;
  images: string[];
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

// Doctor credentials
export const DOCTOR_CREDENTIALS = {
  email: 'doctor@test.com',
  password: 'doctor123',
};

// Consultation price
export const CONSULTATION_PRICE = 49;

// Initial disclaimer — updated to mention 3 free responses (Point 1)
export const DISCLAIMER = `⚠️ IMPORTANT DISCLAIMER
This AI Educational Assistant provides general dermatological information for educational purposes ONLY. It is NOT a substitute for professional medical advice, diagnosis, or treatment.
This assistant CANNOT and WILL NOT:
- Diagnose any skin condition
- Prescribe medications or treatments
- Provide personalized medical advice
Free educational mode includes up to 3 AI responses based on your text description. No image uploads are available in free mode. AI responses may be incomplete without visual assessment.
For a full image-based review by Dr. Attili, please consider our paid consultation ($${CONSULTATION_PRICE}).
By continuing, you acknowledge that you understand these limitations.`;
