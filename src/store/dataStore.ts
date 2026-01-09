import { Conversation, Message, User, ConversationMode } from '@/types/dermatology';

// Generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15);

// In-memory storage (will also sync to localStorage)
let conversations: Conversation[] = [];
let messages: Message[] = [];
let currentUser: User | null = null;

const STORAGE_KEYS = {
  conversations: 'derm_conversations',
  messages: 'derm_messages',
  currentUser: 'derm_current_user',
};

// Initialize from localStorage
export const initializeStore = () => {
  try {
    const storedConversations = localStorage.getItem(STORAGE_KEYS.conversations);
    const storedMessages = localStorage.getItem(STORAGE_KEYS.messages);
    const storedUser = localStorage.getItem(STORAGE_KEYS.currentUser);
    
    if (storedConversations) {
      conversations = JSON.parse(storedConversations).map((c: any) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
      }));
    }
    
    if (storedMessages) {
      messages = JSON.parse(storedMessages).map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }));
    }
    
    if (storedUser) {
      currentUser = JSON.parse(storedUser);
    }
  } catch (error) {
    console.error('Failed to initialize store from localStorage:', error);
  }
};

// Save to localStorage
const persistStore = () => {
  try {
    localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(conversations));
    localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages));
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.currentUser);
    }
  } catch (error) {
    console.error('Failed to persist store:', error);
  }
};

// User operations
export const setCurrentUser = (user: User | null) => {
  currentUser = user;
  persistStore();
};

export const getCurrentUser = () => currentUser;

export const logout = () => {
  currentUser = null;
  localStorage.removeItem(STORAGE_KEYS.currentUser);
};

// Conversation operations
export const createConversation = (patientEmail: string, patientName: string): Conversation => {
  const conversation: Conversation = {
    id: generateId(),
    patientEmail,
    patientName,
    mode: 'general_education',
    paymentStatus: 'unpaid',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  conversations.push(conversation);
  persistStore();
  return conversation;
};

export const getConversation = (id: string) => conversations.find(c => c.id === id);

export const getConversationByPatient = (email: string) => 
  conversations.find(c => c.patientEmail === email && c.status === 'active');

export const getAllConversations = () => [...conversations];

export const updateConversation = (id: string, updates: Partial<Conversation>) => {
  const index = conversations.findIndex(c => c.id === id);
  if (index !== -1) {
    conversations[index] = { ...conversations[index], ...updates, updatedAt: new Date() };
    persistStore();
    return conversations[index];
  }
  return null;
};

export const updateConversationMode = (id: string, mode: ConversationMode) => {
  return updateConversation(id, { mode });
};

export const setPaymentPaid = (id: string) => {
  return updateConversation(id, { paymentStatus: 'paid', mode: 'post_payment_intake' });
};

export const completeConversation = (id: string) => {
  return updateConversation(id, { status: 'completed', mode: 'final_output' });
};

// Message operations
export const addMessage = (
  conversationId: string,
  role: Message['role'],
  content: string,
  isVisible: boolean = true
): Message => {
  const message: Message = {
    id: generateId(),
    conversationId,
    role,
    content,
    timestamp: new Date(),
    isVisible,
  };
  messages.push(message);
  persistStore();
  return message;
};

export const getMessages = (conversationId: string, includeHidden: boolean = false) => {
  return messages
    .filter(m => m.conversationId === conversationId && (includeHidden || m.isVisible))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
};

export const getAllMessages = () => [...messages];

// Reset for testing
export const resetConversation = (conversationId: string) => {
  messages = messages.filter(m => m.conversationId !== conversationId);
  const index = conversations.findIndex(c => c.id === conversationId);
  if (index !== -1) {
    conversations[index] = {
      ...conversations[index],
      mode: 'general_education',
      paymentStatus: 'unpaid',
      status: 'active',
      intakeData: undefined,
      doctorNotes: undefined,
      updatedAt: new Date(),
    };
  }
  persistStore();
};

export const resetAllData = () => {
  conversations = [];
  messages = [];
  currentUser = null;
  localStorage.removeItem(STORAGE_KEYS.conversations);
  localStorage.removeItem(STORAGE_KEYS.messages);
  localStorage.removeItem(STORAGE_KEYS.currentUser);
};

// Initialize on module load
initializeStore();
