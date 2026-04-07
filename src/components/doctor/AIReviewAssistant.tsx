import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Send, X, ImagePlus, AlertTriangle } from 'lucide-react';
import { BASE_URL } from '@/base_url';
import ReactMarkdown from 'react-markdown';

interface AIReviewAssistantProps {
  onClose: () => void;
  contextData: string;
  conversationId: string;
  onApplyContent?: (content: string) => void;
  editorContent?: string;
  prefillMessage?: string;
  onPrefillConsumed?: () => void;
}

const SECTION_TITLES = [
  'Most Consistent With',
  'Close Differentials',
  'Morphologic Justification',
  'Educational Treatment Framework',
  'Typical Course and Prognosis',
  'When In-Person Evaluation Is Considered',
  'Educational References',
];

const FINAL_LINE = "You're welcome to ask follow-up questions.";

function cleanBody(text: string): string {
  return (text || '')
    .replace(/\r/g, '')
    .replace(/^\s*\((?:if any|if relevant|ranked)\)\s*:?\s*$/gim, '')
    .replace(/\s*\((?:if any|if relevant|ranked)\)\s*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeHeading(title: string): string {
  return title.trim().toLowerCase();
}

function generateFallbackContent(section: string): string {
  switch (section) {
    case 'Most Consistent With':
      return 'Preliminary clinical impression based on available intake data suggests a dermatologic condition requiring further clinical correlation.';
    case 'Close Differentials':
      return 'Related dermatologic conditions may present with overlapping clinical features and require further evaluation.';
    case 'Morphologic Justification':
      return 'Assessment is based on the provided history and any available images. Morphology suggests a localised dermatologic process requiring clinical correlation.';
    case 'Educational Treatment Framework':
      return 'General supportive care, avoidance of irritants, and clinically appropriate dermatologic management may be considered after physician review.';
    case 'Typical Course and Prognosis':
      return 'Course depends on the underlying condition and may vary. General improvement is expected with appropriate management over several weeks.';
    case 'When In-Person Evaluation Is Considered':
      return 'In-person evaluation is recommended if symptoms worsen, features are atypical, diagnosis is uncertain, or the condition does not respond as expected.';
    case 'Educational References':
      return 'DermNet NZ\nBritish Association of Dermatologists\nMedscape';
    default:
      return 'Clinical details are limited from the currently available information.';
  }
}

function extractStructuredSections(text: string): Record<string, string> {
  const cleaned = cleanBody(text);
  if (!cleaned) return {};

  const escaped = SECTION_TITLES.map(escapeRegex).join('|');
  const regex = new RegExp(
    `(?:^|\\n)\\s*(?:\\*\\*)?(${escaped})(?:\\*\\*)?\\s*:?\\s*(?=\\n|$)`,
    'gi'
  );

  const matches: Array<{ title: string; index: number; fullLength: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleaned)) !== null) {
    matches.push({
      title: match[1],
      index: match.index,
      fullLength: match[0].length,
    });
  }

  if (matches.length === 0) return {};

  const sections: Record<string, string> = {};
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const start = current.index + current.fullLength;
    const end = next ? next.index : cleaned.length;
    sections[normalizeHeading(current.title)] = cleanBody(cleaned.slice(start, end));
  }

  return sections;
}

function extractLegacyNumberedSections(text: string): Record<string, string> {
  const cleaned = cleanBody(text);
  if (!cleaned) return {};

  const mappings = [
    { patterns: ['Diagnosis', 'Most Consistent With', 'Primary Likely Diagnosis'], target: 'Most Consistent With' },
    { patterns: ['Differential Diagnoses', 'Close Differentials', 'Differentials', 'Differential Diagnoses (Ranked)'], target: 'Close Differentials' },
    { patterns: ['Technical Justification', 'Morphologic Justification', 'Justification', 'Key Morphologic / Clinical Features', 'Key Morphologic Features'], target: 'Morphologic Justification' },
    { patterns: ['Prescription Regimen', 'Educational Treatment Framework', 'Treatment Framework'], target: 'Educational Treatment Framework' },
    { patterns: ['Typical Course and Prognosis', 'Prognosis', 'Course and Prognosis', 'Suggested Investigations', 'Investigations Commonly Considered', 'Investigations'], target: 'Typical Course and Prognosis' },
    { patterns: ['When In-Person Evaluation Is Considered', 'In-Person Evaluation', 'Red Flags', 'Diagnostic Confidence'], target: 'When In-Person Evaluation Is Considered' },
    { patterns: ['Educational References', 'References'], target: 'Educational References' },
  ];

  const sectionHeaders = mappings.flatMap(m => m.patterns.map(escapeRegex)).join('|');
  const regex = new RegExp(
    `(?:^|\\n)\\s*(?:\\d+\\.\\s*)?(?:\\*\\*)?(${sectionHeaders})(?:\\*\\*)?\\s*:?\\s*(?=\\n|$)`,
    'gi'
  );

  const matches: Array<{ title: string; index: number; fullLength: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleaned)) !== null) {
    matches.push({
      title: match[1],
      index: match.index,
      fullLength: match[0].length,
    });
  }

  if (matches.length === 0) return {};

  const sections: Record<string, string> = {};
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const start = current.index + current.fullLength;
    const end = next ? next.index : cleaned.length;
    const body = cleanBody(cleaned.slice(start, end));

    const mapping = mappings.find(m =>
      m.patterns.some(p => p.toLowerCase() === current.title.toLowerCase())
    );

    if (mapping && body) {
      sections[normalizeHeading(mapping.target)] = body;
    }
  }

  return sections;
}

function buildStructuredOutput(sections: Record<string, string>): string {
  const content = SECTION_TITLES.map(title => {
    const key = normalizeHeading(title);
    const body = cleanBody(sections[key] || '') || generateFallbackContent(title);
    return `**${title}**\n\n${body}`.trim();
  }).join('\n\n');

  const cleaned = cleanBody(content);
  if (!cleaned) return '';

  if (cleaned.toLowerCase().includes(FINAL_LINE.toLowerCase())) {
    return cleaned;
  }
  return `${cleaned}\n\n${FINAL_LINE}`;
}

function stripDosingInfo(text: string): string {
  return text
    .replace(/\b\d+(\.\d+)?\s*(mg|mcg|μg|g|ml|mL|%)\b/gi, '')
    .replace(/\b(once|twice|three times|four times)\s+(a\s+)?(day|daily|weekly|nightly)\b/gi, '')
    .replace(/\b(BID|TID|QID|QD|PRN|OD|BD)\b/g, '')
    .replace(/\bevery\s+\d+\s+(hour|hours|hrs?|day|days|week|weeks)\b/gi, '')
    .replace(/\bfor\s+\d+\s+(day|days|week|weeks|month|months)\b/gi, '')
    .replace(/\b(apply|use|take|administer)\s+(twice|once|daily|topically|orally|topical)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s([,.])/g, '$1')
    .trim();
}

function normaliseDraftResponse(raw: string): string {
  const text = cleanBody(raw);
  if (!text || text.length < 30) return buildStructuredOutput({});

  let sections = extractStructuredSections(text);
  if (Object.keys(sections).length === 0) {
    sections = extractLegacyNumberedSections(text);
  }
  if (Object.keys(sections).length === 0) {
    sections = { [normalizeHeading('Most Consistent With')]: text };
  }

  const strippedSections: Record<string, string> = {};
  for (const [key, body] of Object.entries(sections)) {
    strippedSections[key] = stripDosingInfo(body);
  }

  return buildStructuredOutput(strippedSections);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function containsFaceOrPII(imageBase64: string): Promise<boolean> {
  const response = await fetch('/api/openai-vision-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64,
      prompt:
        'Reply with only YES if this image contains a human face or any personal identifying information such as a name, ID number, address, or date of birth. Reply with only NO otherwise.',
    }),
  });

  if (!response.ok) return false;

  const data = await response.json();
  const answer = data.result?.trim().toUpperCase();
  return answer === 'YES';
}

const AIReviewAssistantLink = (props: any) => (
  <a
    {...props}
    target="_blank"
    rel="noopener noreferrer"
    className="text-blue-600 underline break-words"
  />
);

type AssistantMessage = {
  role: 'user' | 'ai';
  content: string;
  draftContent?: string;
};

export const AIReviewAssistant: React.FC<AIReviewAssistantProps> = ({
  onClose,
  contextData,
  conversationId,
  onApplyContent,
  editorContent,
  prefillMessage,
  onPrefillConsumed,
}) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: 'ai',
      content:
        "I'm ready to assist with this case. Ask follow-up questions, request changes, or ask me to revise the assessment. I will reply conversationally. Use Apply to editor when you want the full updated draft inserted into the Assessment editor.",
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefillMessage && prefillMessage.trim()) {
      setInput(prefillMessage.trim());
      onPrefillConsumed?.();
    }
  }, [prefillMessage, onPrefillConsumed]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImageError(null);

    try {
      const base64 = await fileToBase64(file);
      const blocked = await containsFaceOrPII(base64);

      if (blocked) {
        setImageError(
          'This image appears to contain a face or personal identifying information and cannot be uploaded. Please remove personal details and try again.'
        );
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      setPendingImage({ file, previewUrl });
    } catch {
      setImageError('Image check failed. Please try again.');
    }
  }, []);

  const removePendingImage = useCallback(() => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage(null);
    setImageError(null);
  }, [pendingImage]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsLoading(true);

    const imageToClear = pendingImage;
    setPendingImage(null);
    setImageError(null);

    try {
      const authToken = localStorage.getItem('DoctorToken');
      const formData = new FormData();
      formData.append('id', conversationId);
      formData.append('question', userMsg);
      formData.append('currentDraft', editorContent || '');
      formData.append('contextData', contextData);

      if (imageToClear?.file) {
        formData.append('image', imageToClear.file);
      }

      const response = await fetch(`${BASE_URL}/api/doctor_chat_view/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();

      const conversationalReply =
        cleanBody(data.reply || data.result || data.response || data.message || '') ||
        'I updated my recommendation based on your instruction.';

      const structuredDraft = normaliseDraftResponse(
        data.draft_result || data.draft || conversationalReply
      );

      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          content: conversationalReply,
          draftContent: structuredDraft,
        },
      ]);
    } catch (error) {
      console.error('Error consulting AI:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          content: 'I encountered an error. Please ensure the backend is running and try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
      if (imageToClear) URL.revokeObjectURL(imageToClear.previewUrl);
    }
  };

  return (
    <Card className="h-full flex flex-col border-none shadow-none rounded-none">
      <CardHeader className="py-3 px-4 border-b bg-primary/5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2 text-primary">
          <Bot className="h-4 w-4" />
          AI Consultation
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {m.role === 'ai' ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none
                        [&_p]:mb-2 [&_p:last-child]:mb-0 [&_p]:leading-relaxed
                        [&_strong]:font-semibold
                        [&_a]:text-blue-600 [&_a]:underline break-words"
                    >
                      <ReactMarkdown components={{ a: AIReviewAssistantLink }}>
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}

                  {m.role === 'ai' && i > 0 && onApplyContent && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] px-2"
                        onClick={() => onApplyContent(m.draftContent || normaliseDraftResponse(m.content))}
                      >
                        Apply to editor
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

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="p-3 border-t bg-background space-y-2">
          {imageError && (
            <div className="flex items-start gap-1.5 text-[11px] text-destructive bg-destructive/10 rounded px-2 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{imageError}</span>
            </div>
          )}

          {pendingImage && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <img
                  src={pendingImage.previewUrl}
                  alt="Pending upload"
                  className="h-12 w-12 object-cover rounded border border-border"
                />
                <button
                  type="button"
                  onClick={removePendingImage}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Image attached for AI review</p>
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              className="hidden"
              onChange={handleImageSelect}
            />

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <ImagePlus className="h-4 w-4" />
            </Button>

            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask AI to explain, revise, shorten, or change the draft..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isLoading}
            />

            <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
