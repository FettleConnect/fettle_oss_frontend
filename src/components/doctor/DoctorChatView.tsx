import React, { useState, useRef, useEffect } from 'react';
import { Conversation, Message } from '@/types/dermatology';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { IntakeSummaryCard } from './IntakeSummaryCard';
import { AIReviewAssistant } from './AIReviewAssistant';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, FileText, User, RefreshCw, ImagePlus, X, Bot, Sparkles, LayoutPanelLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BASE_URL } from '@/base_url';
import { setDraftResponse } from '@/store/dataStore';

interface DoctorChatViewProps {
  conversation: Conversation;
  messages: Message[];
  onUpdate: () => void;
  onRefresh: () => void;
}

export const DoctorChatView: React.FC<DoctorChatViewProps> = ({
  conversation,
  messages,
  onUpdate,
  onRefresh,
}) => {
  const { toast } = useToast();
  const [internalNotes, setInternalNotes] = useState(conversation.doctorNotes || '');
  const [patientMessage, setPatientMessage] = useState(conversation.draftResponse || '');
  const [isSending, setIsSending] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [showAI, setShowAI] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync draft response if it arrives later
  useEffect(() => {
    if (conversation.draftResponse && !patientMessage) {
      setPatientMessage(conversation.draftResponse);
    }
  }, [conversation.draftResponse, conversation.id]);

  const handleApplyDraft = () => {
    if (conversation.draftResponse) {
      setPatientMessage(conversation.draftResponse);
      toast({
        title: 'Draft Applied',
        description: 'AI-generated draft has been loaded into the editor.',
      });
    }
  };

  const handleRefineWithAI = () => {
    setShowAI(true);
    // This will be picked up by AIReviewAssistant if it's listening to parent state or via context
    toast({
      title: 'Consulting AI',
      description: 'Opening AI assistant to refine your response.',
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImages(prev => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveNotes = () => {
    // Notes are local for now
    toast({
      title: 'Notes Saved',
      description: 'Internal notes have been saved.',
    });
  };

  const handleSendToPatient = async () => {
    if (!patientMessage.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a message to send to the patient.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    
    try {
      const authToken = localStorage.getItem('DoctorToken');
      const formData = new FormData();
      formData.append('id', String(conversation.id));
      formData.append('question', patientMessage);
      
      if (images.length > 0) {
        // Convert each base64 data URL to Blob and append as file
        for (let i = 0; i < images.length; i++) {
          const dataUrl = images[i];
          const response_blob = await fetch(dataUrl);
          const blob = await response_blob.blob();
          formData.append('image', blob, `image_${i + 1}.jpg`);
        }
      }
      
      const response = await fetch(`${BASE_URL}:8000/api/doctor_send_response/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setPatientMessage('');
      setImages([]);
      onUpdate();
      
      toast({
        title: 'Response Sent',
        description: 'Your response has been sent to the patient.',
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  // Doctor can respond if patient has paid or if a draft exists
  const canRespond = conversation.paymentStatus === 'paid' || !!conversation.draftResponse;
  const isCompleted = conversation.status === 'completed';

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Patient Info Header */}
      <div className="border-b border-border bg-card px-6 py-4 shadow-sm z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-none mb-1">{conversation.patientName}</h3>
              <p className="text-sm text-muted-foreground font-mono">{conversation.patientEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onRefresh} className="text-muted-foreground hover:text-foreground">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync
            </Button>
            <div className="h-6 w-px bg-border mx-1" />
            <Badge variant={conversation.paymentStatus === 'paid' ? 'default' : 'secondary'} className="px-3 py-1">
              {conversation.paymentStatus === 'paid' ? 'Paid Consultation' : 'Unpaid'}
            </Badge>
            <Badge variant={isCompleted ? 'secondary' : 'outline'} className="px-3 py-1">
              {conversation.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 max-w-5xl mx-auto w-full">
          <ScrollArea className="flex-1 px-6 py-6">
            <div className="space-y-8 max-w-4xl mx-auto">
              
              {/* Intake Summary Section */}
              {conversation.intakeData && (
                <section>
                   <IntakeSummaryCard intakeData={conversation.intakeData} />
                </section>
              )}

              {/* Chat History Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest bg-slate-50 dark:bg-slate-950 px-3">
                    Conversation History
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                {messages.length > 0 ? (
                  messages.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8 italic">
                    No conversation history available.
                  </div>
                )}
              </section>
            </div>
          </ScrollArea>

          {/* Doctor Response Area */}
          {canRespond && !isCompleted && (
            <div className="border-t border-border bg-card p-6 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-20">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Doctor's Assessment & Response
                  </label>
                  <div className="flex gap-2">
                    {conversation.draftResponse && patientMessage !== conversation.draftResponse && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleApplyDraft}
                        className="gap-2 text-primary border-primary/20 hover:bg-primary/5"
                      >
                        <Bot className="h-4 w-4" />
                        Apply AI Draft
                      </Button>
                    )}
                    <Button 
                      variant={showAI ? "default" : "secondary"} 
                      size="sm" 
                      onClick={() => setShowAI(!showAI)}
                      className="gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      {showAI ? 'Hide AI Tools' : 'Refine with AI'}
                    </Button>
                  </div>
                </div>
                
                {/* Image Preview */}
                {images.length > 0 && (
                  <div className="flex gap-3 mb-3 flex-wrap bg-muted/30 p-3 rounded-lg border border-dashed">
                    {images.map((img, index) => (
                      <div key={index} className="relative group">
                        <img src={img} alt={`Upload ${index + 1}`} className="h-20 w-20 object-cover rounded-md border border-border shadow-sm" />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <Textarea
                  value={patientMessage}
                  onChange={(e) => setPatientMessage(e.target.value)}
                  placeholder="Write your professional assessment here. You can use the AI-generated draft as a starting point..."
                  className="min-h-[150px] text-base leading-relaxed p-4 resize-y shadow-sm focus-visible:ring-primary"
                />
                
                <div className="flex justify-between items-center pt-2">
                   <div className="flex gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImagePlus className="h-4 w-4 mr-2" />
                        Attach Images
                      </Button>
                   </div>
                   <Button 
                    onClick={handleSendToPatient} 
                    disabled={isSending || !patientMessage.trim()}
                    size="lg"
                    className="px-8 shadow-md hover:shadow-lg transition-all"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Response
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar (Notes & AI) */}
        <div className={`w-96 border-l border-border bg-card flex flex-col transition-all duration-300 ${showAI ? 'translate-x-0' : 'translate-x-full hidden'}`}>
          {showAI ? (
            <AIReviewAssistant 
              onClose={() => setShowAI(false)} 
              conversationId={String(conversation.id)}
              contextData={JSON.stringify(conversation.intakeData || {})}
              onApplyContent={(content) => {
                setPatientMessage(prev => prev ? `${prev}\n\n${content}` : content);
                toast({
                  title: 'Content Added',
                  description: 'AI suggestion has been appended to your response.',
                });
              }}
            />
          ) : (
             <div className="p-4">
                {/* Fallback for when AI is hidden but sidebar space is reserved - though we're hiding it with css above */}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

