import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Send, X, Copy, Check } from 'lucide-react';
import { BASE_URL } from '@/base_url';
import ReactMarkdown from 'react-markdown';

interface AIReviewAssistantProps {
  onClose: () => void;
  contextData: string;
  conversationId: string;
  onApplyContent?: (content: string) => void;
}

// FIX #4: mirrors the backend draft_format exactly — prepended to every question
const STRUCTURED_FORMAT_PROMPT = `When generating or refining a patient response draft, you MUST present the output in this exact order using short paragraphs — NOT heavily nested bullet lists:

1. Most Consistent With
State the most likely pattern category in 2–3 sentences. Use category-based classification. Provide a brief educational explanation of why this pattern fits.

2. Close Differentials
Name 2–3 differential patterns in 1–2 sentences. No need for detailed explanation of each.

3. Morphologic Justification
Write a short paragraph explaining the visual features that support the primary classification. Do not use a bullet list here.

4. Educational Treatment Framework
Present treatment classes in escalation order: foundational care first, then topical agents, then procedural options. Medication names are permitted. No dosing, timing, or application instructions.

5. Investigations Commonly Considered
Include if clinically relevant. Frame biopsy as a classification tool, not a diagnostic confirmation.

6. Educational References
Cite NHS, DermNet NZ, BAD, or CDC sources only. Descriptive, not instructive.

Length: Total response should not exceed 400 words unless clinical complexity genuinely requires it.
Tone: Textbook-style. Calm authority. No personalisation or directives. Emotionally stable ending.
Do NOT use headings like "Diagnosis", "Differential", "Prescription Regimen", or "Technical Justification".
Do NOT include dosing, timing, or application instructions.`;

export const AIReviewAssistant: React.FC<AIReviewAssistantProps> = ({
  onClose, contextData, conversationId, onApplyContent
}) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([
    { role: 'ai', content: "I'm ready to assist with this case. I have the patient's intake data. How can I help you refine the diagnosis or treatment plan?\n\nAny draft I generate will follow the structured format: Most Consistent With → Close Differentials → Morphologic Justification → Educational Treatment Framework → Investigations → References." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appliedIndex, setAppliedIndex] = useState<number | null>(null);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput(''); setIsLoading(true);
    try {
      const authToken = localStorage.getItem('DoctorToken');
      const formData = new FormData();
      formData.append('id', conversationId);
      // FIX #4: prepend structured format so AI always returns 6-section output
      formData.append('question', `${STRUCTURED_FORMAT_PROMPT}\n\nDoctor's question: ${userMsg}`);
      const response = await fetch(`${BASE_URL}/api/doctor_chat_view/`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` }, body: formData,
      });
      if (!response.ok) throw new Error('Failed to get AI response');
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'ai', content: data.result }]);
    } catch (error) {
      console.error('Error consulting AI:', error);
      setMessages(prev => [...prev, { role: 'ai', content: "I encountered an error. Please ensure the backend is running and try again." }]);
    } finally { setIsLoading(false); }
  };

  // FIX #6: fully REPLACES editor content — does not append
  const handleApply = (content: string, index: number) => {
    if (!onApplyContent) return;
    const cleaned = content.replace(/\n{3,}/g, '\n\n').trim();
    onApplyContent(cleaned); // → setPatientMessage(content) in DoctorChatView = full replace
    setAppliedIndex(index);
    setTimeout(() => setAppliedIndex(null), 2000);
  };

  return (
    <Card className="h-full flex flex-col border-none shadow-none rounded-none">
      <CardHeader className="py-3 px-4 border-b bg-primary/5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2 text-primary"><Bot className="h-4 w-4" />AI Consultation</CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                  {m.role === 'ai' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none
                      [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1
                      [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1
                      [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1
                      [&_p]:mb-2 [&_p:last-child]:mb-0 [&_p]:leading-relaxed
                      [&_ul]:pl-4 [&_ul]:mb-2 [&_li]:mb-0.5
                      [&_ol]:pl-4 [&_ol]:mb-2 [&_strong]:font-semibold">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                  {m.role === 'ai' && i > 0 && onApplyContent && (
                    <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground">Replaces current assessment</p>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1 hover:bg-background/50" onClick={() => handleApply(m.content, i)}>
                        {appliedIndex === i ? <><Check className="h-3 w-3 text-green-600" />Applied</> : <><Copy className="h-3 w-3" />Apply to Editor</>}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted text-foreground rounded-lg px-3 py-2 text-sm flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce delay-75" />
                  <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce delay-150" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="p-3 border-t bg-background">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
            <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask for diagnosis, plan..." className="flex-1 h-9 text-xs" />
            <Button type="submit" size="icon" className="h-9 w-9" disabled={isLoading || !input.trim()}><Send className="h-4 w-4" /></Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};
