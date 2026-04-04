import React, { useState, useEffect, useCallback } from 'react';
import { ConversationList } from './ConversationList';
import { DoctorChatView } from './DoctorChatView';
import { SystemPromptEditor } from './SystemPromptEditor';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Menu, X, Users, Settings, Stethoscope } from 'lucide-react';
import { Conversation, Message } from '@/types/dermatology';
import { BASE_URL } from '@/base_url';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from '@/lib/utils';

interface User {
  role: 'doctor' | 'patient';
  name: string;
  email?: string;
}

interface DoctorDashboardProps {
  user: User;
  onLogout: () => void;
}

interface TabDoc {
  id: string | number;
  name: string;
  email: string;
  payment_status: string;
  active: boolean;
  intake_data?: any;
  doctor_draft?: string;
  total_paid?: number;
  is_read?: boolean;
  updated_at?: string;
}

interface ConvMessage {
  id: string;
  role: string;
  content: string;
  images?: string[];
}

interface SidebarContentProps {
  filter: 'all' | 'paid' | 'unpaid' | 'active' | 'completed';
  setFilter: (filter: 'all' | 'paid' | 'unpaid' | 'active' | 'completed') => void;
  isMobile: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  conversations: Conversation[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

const SidebarContent: React.FC<SidebarContentProps> = ({ 
  filter, 
  setFilter, 
  isMobile, 
  setIsSidebarOpen, 
  conversations, 
  selectedId, 
  setSelectedId 
}) => (
  <div className="flex flex-col h-full bg-card">
    <div className="p-4 border-b border-border">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-navy flex items-center gap-2 uppercase tracking-wider text-sm">
          <Users className="h-4 w-4 text-accent-blue" />
          Patient Registry
        </h2>
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList className="w-full grid grid-cols-3 bg-muted/50">
          <TabsTrigger value="all" className="text-[10px] font-bold uppercase">All</TabsTrigger>
          <TabsTrigger value="paid" className="text-[10px] font-bold uppercase">Paid</TabsTrigger>
          <TabsTrigger value="active" className="text-[10px] font-bold uppercase">Active</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
    <div className="flex-1 overflow-auto">
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          if (isMobile) setIsSidebarOpen(false);
        }}
        filter={filter}
      />
    </div>
  </div>
);

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ user, onLogout }) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid' | 'active' | 'completed'>('all');
  const [activeView, setActiveView] = useState<'patients' | 'settings'>('patients');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const authToken = localStorage.getItem('DoctorToken');
      const response = await fetch(`${BASE_URL}/api/doctor_tabs/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch conversations');
      const data = await response.json();

      if (data.tabs_doc && Array.isArray(data.tabs_doc)) {
        const convs: Conversation[] = data.tabs_doc.map((tab: TabDoc) => {
          const isPaid = String(tab.payment_status).toUpperCase() === 'PAID';
          const rawIntake = tab.intake_data || {};
          const intakeData = {
            duration: rawIntake.duration || '',
            symptoms: rawIntake.symptoms || '',
            location: rawIntake.location || '',
            medicationsTried: rawIntake.medications_tried || rawIntake.meds || '',
            priorDiagnoses: rawIntake.prior_diagnoses || '',
            relevantHealthHistory: rawIntake.relevant_health_history || rawIntake.history || '',
            images: rawIntake.images || [],
          };

          return {
            id: String(tab.id),
            patient_id: String(tab.patient_id),
            patientEmail: tab.email,
            patientName: tab.name,
            mode: tab.mode as any || (isPaid ? 'post_payment_intake' : 'general_education'),
            paymentStatus: isPaid ? 'paid' : 'unpaid',
            status: tab.status as any || (tab.active ? 'active' : 'not_active'),
            intakeData: Object.values(intakeData).some(v => v !== '' && (Array.isArray(v) ? v.length > 0 : true)) ? intakeData : undefined,
            draftResponse: tab.doctor_draft || undefined,
            is_read: tab.is_read,
            updatedAt: tab.updated_at ? new Date(tab.updated_at) : undefined,
          };
        });
        setConversations(convs);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({ title: 'Error', description: 'Failed to load conversations.', variant: 'destructive' });
    }
  }, [toast]);

  const loadConversationMessages = useCallback(async (id: string) => {
    try {
      const authToken = localStorage.getItem('DoctorToken');
      const response = await fetch(`${BASE_URL}/api/doctor_conversation/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();

      if (data.conv && Array.isArray(data.conv)) {
        const msgs: Message[] = data.conv.map((msg: ConvMessage) => {
          let role: 'patient' | 'ai' | 'doctor' = 'patient';
          let senderName = msg.role;
          if (msg.role === 'ai') { role = 'ai'; senderName = 'AI'; }
          else if (msg.role === 'doctor') { role = 'doctor'; senderName = 'You'; }

          return {
            id: msg.id,
            conversationId: id,
            role,
            content: msg.content,
            images: msg.images ?? [],
            timestamp: new Date(),
            isVisible: true,
            senderName,
          };
        });
        setSelectedMessages(msgs);
        setConversations(prev => prev.map(c => c.id === id ? { ...c, is_read: true } : c));
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, refreshKey]);

  useEffect(() => {
    if (selectedId) {
      const conv = conversations.find(c => c.id === selectedId);
      setSelectedConversation(conv || null);
      if (conv) loadConversationMessages(selectedId);
    } else {
      setSelectedConversation(null);
      setSelectedMessages([]);
    }
  }, [selectedId, conversations, loadConversationMessages, refreshKey]);

  const handleUpdate = () => setRefreshKey(k => k + 1);

  return (
    <section className="bg-gray-50 py-12 px-4 md:px-6 min-h-[80vh]">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-navy flex items-center justify-center text-white shadow-lg shadow-navy/20">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-navy tracking-tight uppercase">Clinical Portal</h1>
              <p className="text-xs font-bold text-accent-blue uppercase tracking-widest">Consultant Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 text-xs font-bold text-navy shadow-sm">
              <span className="text-muted-foreground mr-2 font-normal">Active Session:</span> {user?.email}
            </div>
            <Button variant="outline" size="sm" onClick={loadConversations} className="h-10 border-gray-200 hover:bg-gray-50 text-navy font-bold text-xs uppercase tracking-wider">
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Sync
            </Button>
            <Button variant="ghost" size="sm" onClick={onLogout} className="h-10 text-destructive font-bold text-xs uppercase tracking-wider">
              Logout
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-navy/5 border border-gray-100 overflow-hidden flex flex-col md:flex-row h-[800px]">
          {/* Desktop Sidebar */}
          {!isMobile && (
            <div className="w-80 border-r border-border flex flex-col bg-card">
              <SidebarContent 
                filter={filter} 
                setFilter={setFilter} 
                isMobile={isMobile} 
                setIsSidebarOpen={setIsSidebarOpen} 
                conversations={conversations} 
                selectedId={selectedId} 
                setSelectedId={setSelectedId} 
              />
            </div>
          )}

          {/* Mobile Sidebar Trigger */}
          {isMobile && !isSidebarOpen && (
            <div className="absolute top-20 left-4 z-30">
              <Button variant="outline" size="icon" onClick={() => setIsSidebarOpen(true)} className="bg-white/80 backdrop-blur-sm shadow-md">
                <Menu className="h-4 w-4 text-navy" />
              </Button>
            </div>
          )}

          {/* Mobile Sidebar Sheet */}
          {isMobile && (
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetContent side="left" className="p-0 w-80">
                <SidebarContent 
                  filter={filter} 
                  setFilter={setFilter} 
                  isMobile={isMobile} 
                  setIsSidebarOpen={setIsSidebarOpen} 
                  conversations={conversations} 
                  selectedId={selectedId} 
                  setSelectedId={setSelectedId} 
                />
              </SheetContent>
            </Sheet>
          )}

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 relative">
            {/* Context Tab Bar */}
            <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center justify-between z-20">
              <div className="flex gap-4">
                <button 
                  onClick={() => setActiveView('patients')}
                  className={cn("text-[10px] font-bold uppercase tracking-widest pb-1 transition-all", 
                    activeView === 'patients' ? "text-navy border-b-2 border-navy" : "text-muted-foreground hover:text-navy")}
                >
                  Patient Review
                </button>
                <button 
                  onClick={() => setActiveView('settings')}
                  className={cn("text-[10px] font-bold uppercase tracking-widest pb-1 transition-all", 
                    activeView === 'settings' ? "text-navy border-b-2 border-navy" : "text-muted-foreground hover:text-navy")}
                >
                  System Config
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              {activeView === 'settings' ? (
                <ScrollArea className="h-full bg-gray-50/30">
                  <div className="p-6 max-w-4xl mx-auto">
                    <SystemPromptEditor />
                  </div>
                </ScrollArea>
              ) : selectedConversation ? (
                <DoctorChatView
                  conversation={selectedConversation}
                  messages={selectedMessages}
                  onUpdate={handleUpdate}
                  onRefresh={() => {
                    loadConversations();
                    if (selectedId) loadConversationMessages(selectedId);
                  }}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground bg-gray-50/20">
                  <div className="text-center p-6 space-y-4">
                    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                      <Stethoscope className="h-10 w-10 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-bold text-navy uppercase tracking-tight">Select Patient Record</h3>
                    <p className="text-sm max-w-xs mx-auto">Select a patient from the registry to begin clinical assessment and AI draft generation.</p>
                    {isMobile && (
                      <Button variant="outline" onClick={() => setIsSidebarOpen(true)} className="mt-4 border-navy text-navy font-bold uppercase text-xs">
                        Open Patient List
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
