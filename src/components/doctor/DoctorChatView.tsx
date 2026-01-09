import React, { useState, useRef } from 'react';
import { Conversation, Message } from '@/types/dermatology';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, FileText, User, RefreshCw, ImagePlus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BASE_URL } from '@/base_url';

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
  const [patientMessage, setPatientMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      
      const response = await fetch(`${BASE_URL}:8000/api/doctor_chat_view/`, {
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

  // Doctor can respond only if patient has paid
  const canRespond = conversation.paymentStatus === 'paid';
  const isCompleted = conversation.status === 'completed';

  return (
    <div className="flex flex-col h-full">
      {/* Patient Info Header */}
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{conversation.patientName}</h3>
              <p className="text-sm text-muted-foreground">{conversation.patientEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Badge variant={conversation.paymentStatus === 'paid' ? 'default' : 'secondary'}>
              {conversation.paymentStatus}
            </Badge>
            <Badge variant={isCompleted ? 'secondary' : 'outline'}>
              {conversation.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Chat History */}
        <div className="flex-1 flex flex-col min-w-0">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  No messages yet
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Doctor Response Area */}
          {canRespond && !isCompleted && (
            <div className="border-t border-border bg-card p-4">
              <label className="text-sm font-medium mb-2 block">
                Send Response to Patient
              </label>
              
              {/* Image Preview */}
              {images.length > 0 && (
                <div className="flex gap-2 mb-3 flex-wrap">
                  {images.map((img, index) => (
                    <div key={index} className="relative">
                      <img src={img} alt={`Upload ${index + 1}`} className="h-16 w-16 object-cover rounded-lg border border-border" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
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
                placeholder="Write your professional assessment and recommendations..."
                className="min-h-[120px] mb-3"
              />
              
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
                  Add Images
                </Button>
                <Button 
                  onClick={handleSendToPatient} 
                  disabled={isSending || !patientMessage.trim()}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send to Patient
                </Button>
              </div>
            </div>
          )}

          {isCompleted && (
            <div className="border-t border-border bg-muted/50 p-4 text-center text-muted-foreground">
              This consultation has been completed.
            </div>
          )}

          {!canRespond && !isCompleted && (
            <div className="border-t border-border bg-muted/50 p-4 text-center text-muted-foreground">
              Patient has not paid for consultation yet.
            </div>
          )}
        </div>

        {/* Internal Notes Sidebar */}
        <div className="w-80 border-l border-border bg-muted/30 flex flex-col">
          <Card className="m-4 flex-1 flex flex-col">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Internal Notes
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Private notes (not visible to patient)
              </p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <Textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Add private notes about this case..."
                className="flex-1 min-h-[200px] resize-none"
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSaveNotes}
                className="mt-3"
              >
                Save Notes
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
