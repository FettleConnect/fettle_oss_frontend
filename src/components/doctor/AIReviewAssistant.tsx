import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Send, X, ImagePlus, AlertTriangle, CheckCircle2 } from 'lucide-react';
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

type AssistantMessage = {
  role: 'user' | 'ai';
  content: string;
  applyText?: string;
};

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
  return (text || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeHeading(title: string): string {
  return title.trim().toLowerCase();
}

function stripMarkdownBold(value: string): string {
  return value.replace(/\*\*/g, '').trim();
}

function generateFallbackContent(section: string): string {
  switch (section) {
    case 'Most Consistent With':
      return 'Preliminary clinical impression based on available intake data suggests a dermatologic condition requiring further clinical correlation.';
    case 'Close Differentials':
      return 'Related dermatologic conditions may present with overlapping features.';
    case 'Morphologic Justification':
      return 'Assessment is based on the provided history and any available images.';
    case 'Educational Treatment Framework':
      return 'General supportive care, avoidance of irritants, and standard dermatologic management may be considered in an educational context.';
    case 'Typical Course and Prognosis':
      return 'Course varies depending on the condition and may fluctuate over time.';
    case 'When In-Person Evaluation Is Considered':
      return 'In-person evaluation is considered if the condition is worsening, atypical, or not improving as expected.';
    case 'Educational References':
      return 'DermNet NZ\nBritish Association of Dermatologists\nMedscape';
    default:
      return 'Clinical details are limited from the currently available information.';
  }
}

function parseStructuredSections(text: string): Record<string, string> {
  const cleaned = cleanBody(stripMarkdownBold(text));
  if (!cleaned) return {};

  const sections: Record<string, string> = {};
  const lines = cleaned.split('\n');

  let currentTitle: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!currentTitle) return;
    const body = cleanBody(buffer.join('\n'));
    if (body) {
      sections[normalizeHeading(currentTitle)] = body;
    }
    buffer = [];
  };

  const headingMap: Record<string, string> = {
    diagnosis: 'Most Consistent With',
    'most consistent with': 'Most Consistent With',
    'primary likely diagnosis': 'Most Consistent With',

    'differential diagnoses': 'Close Differentials',
    'differential diagnoses (ranked)': 'Close Differentials',
    'close differentials': 'Close Differentials',
    differentials: 'Close Differentials',

    'technical justification': 'Morphologic Justification',
    'morphologic justification': 'Morphologic Justification',
    justification: 'Morphologic Justification',
    'key morphologic / clinical features': 'Morphologic Justification',

    'prescription regimen': 'Educational Treatment Framework',
    'educational treatment framework': 'Educational Treatment Framework',
    'treatment framework': 'Educational Treatment Framework',

    'typical course and prognosis': 'Typical Course and Prognosis',
    prognosis: 'Typical Course and Prognosis',

    'when in-person evaluation is considered': 'When In-Person Evaluation Is Considered',
    'in-person evaluation': 'When In-Person Evaluation Is Considered',
    'red flags': 'When In-Person Evaluation Is Considered',
    'red flags (if any)': 'When In-Person Evaluation Is Considered',

    'educational references': 'Educational References',
    references: 'Educational References',
    'suggested investigations': 'Educational References',
    'suggested investigations (if relevant)': 'Educational References',
    investigations: 'Educational References',
    'investigations commonly considered': 'Educational References',
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (currentTitle) buffer.push('');
      continue;
    }

    const normalizedLine = stripMarkdownBold(line);

    let matchedTitle: string | null = null;
    let inlineBody = '';

    for (const candidate of Object.keys(headingMap)) {
      const regex = new RegExp(
        `^(?:\\d+\\.\\s*)?${candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:?\\s*(.*)$`,
        'i'
      );
      const match = normalizedLine.match(regex);
      if (match) {
        matchedTitle = headingMap[candidate];
        inlineBody = (match[1] || '').trim();
        break;
      }
    }

    if (!matchedTitle) {
      for (const title of SECTION_TITLES) {
        const regex = new RegExp(
          `^(?:\\d+\\.\\s*)?${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:?\\s*(.*)$`,
          'i'
        );
        const match = normalizedLine.match(regex);
        if (match) {
          matchedTitle = title;
          inlineBody = (match[1] || '').trim();
          break;
        }
      }
    }

    if (matchedTitle) {
      flush();
      currentTitle = matchedTitle;
      if (inlineBody) buffer.push(inlineBody);
      continue;
    }

    if (currentTitle) {
      buffer.push(rawLine);
    }
  }

  flush();
  return sections;
}

function buildStructuredOutput(
  sections: Record<string, string>,
  options?: {
    fillMissing?: boolean;
    boldHeadings?: boolean;
  }
): string {
  const fillMissing = options?.fillMissing ?? true;
  const boldHeadings = options?.boldHeadings ?? false;

  const blocks: string[] = [];

  for (const title of SECTION_TITLES) {
    const key = normalizeHeading(title);
    let body = cleanBody(sections[key] || '');

    if (!body && fillMissing) {
      body = generateFallbackContent(title);
    }

    if (!body) continue;

    const heading = boldHeadings ? `**${title}**` : title;
    blocks.push(`${heading}\n\n${body}`.trim());
  }

  const cleaned = cleanBody(blocks.join('\n\n'));
  if (!cleaned) return '';

  if (cleaned.toLowerCase().includes(FINAL_LINE.toLowerCase())) return cleaned;
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

function normaliseAIResponse(raw: string, boldHeadings = false): string {
  const text = cleanBody(raw);
  if (!text || text.length < 20) {
    return buildStructuredOutput({}, { fillMissing: true, boldHeadings });
  }

  let sections = parseStructuredSections(text);

  if (Object.keys(sections).length === 0) {
    sections = {
      [normalizeHeading('Most Consistent With')]: text,
    };
  }

  const stripped: Record<string, string> = {};
  for (const [key, body] of Object.entries(sections)) {
    const cleaned = stripDosingInfo(body);
    if (cleanBody(cleaned)) {
      stripped[key] = cleaned;
    }
  }

  return buildStructuredOutput(stripped, {
    fillMissing: true,
    boldHeadings,
  });
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

  const data = await response.json();
  return data.result?.trim().toUpperCase() === 'YES';
}

const AIReviewAssistantLink = (props: any) => (
  <a
    {...props}
    target="_blank"
    rel="noopener noreferrer"
    className="text-blue-600 underline break-words"
  />
);

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
        "I'm ready to assist with this case. Type your instruction below, for example:\n\n- Regenerate the full draft\n- Strengthen all sections\n- Update the diagnosis and differentials\n- Improve morphologic justification\n- Replace the whole Assessment & Response with a more complete version\n\nUse the **Apply to editor** button under any response to replace the full Assessment & Response draft.",
    },
  ]);

  const storageKey = useMemo(
    () => `ai-review-assistant-input:${conversationId || 'default'}`,
    [conversationId]
  );

  const getSavedDraft = useCallback((): string => {
    try {
      return sessionStorage.getItem(storageKey) || '';
    } catch {
      return '';
    }
  }, [storageKey]);

  const [input, setInput] = useState<string>(() => {
    try {
      return sessionStorage.getItem(storageKey) || '';
    } catch {
      return '';
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [appliedIndex, setAppliedIndex] = useState<number | null>(null);
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAppliedPrefillRef = useRef<string>('');
  const didRestoreRef = useRef(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, input);
    } catch {
      // ignore storage errors
    }
  }, [input, storageKey]);

  useEffect(() => {
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;

    const savedDraft = getSavedDraft();
    if (savedDraft.trim()) {
      setInput(savedDraft);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    const trimmedPrefill = prefillMessage?.trim() || '';
    if (!trimmedPrefill) return;

    lastAppliedPrefillRef.current = trimmedPrefill;
    setInput(trimmedPrefill);
    onPrefillConsumed?.();
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [getSavedDraft, prefillMessage, onPrefillConsumed]);

  useEffect(() => {
    const trimmedPrefill = prefillMessage?.trim() || '';
    if (!trimmedPrefill) return;
    if (lastAppliedPrefillRef.current === trimmedPrefill) return;

    setInput((currentInput) => {
      if (currentInput.trim()) return currentInput;
      lastAppliedPrefillRef.current = trimmedPrefill;
      return trimmedPrefill;
    });

    onPrefillConsumed?.();
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
          'This image appears to contain a face or personal identifying information and cannot be uploaded.'
        );
        return;
      }

      setPendingImage({ file, previewUrl: URL.createObjectURL(file) });
    } catch {
      setImageError('Image check failed. Please try again.');
    }
  }, []);

  const removePendingImage = useCallback(() => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage(null);
    setImageError(null);
  }, [pendingImage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const clearStoredDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // ignore storage errors
    }
  }, [storageKey]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    clearStoredDraft();
    setIsLoading(true);
    setAppliedIndex(null);

    const imageToClear = pendingImage;
    setPendingImage(null);
    setImageError(null);

    try {
      const authToken = localStorage.getItem('DoctorToken');
      const formData = new FormData();
      formData.append('id', conversationId);
      formData.append('question', userMsg);
      formData.append('currentDraft', editorContent || '');
      formData.append('contextData', contextData || '');

      if (imageToClear?.file) {
        formData.append('image', imageToClear.file);
      }

      const response = await fetch(`${BASE_URL}/api/doctor_chat_view/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || data?.error === 1) {
        throw new Error(data?.errorMsg || 'Failed to get AI response');
      }

      const rawAiContent: string =
        data.result?.trim() || data.response?.trim() || data.message?.trim() || '';

      const plainApplyText = normaliseAIResponse(rawAiContent, false);
      const displayText = normaliseAIResponse(rawAiContent, true);

      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: displayText,
          applyText: plainApplyText,
        },
      ]);
    } catch (error: any) {
      console.error('Error consulting AI:', error);

      const fallbackPlain = normaliseAIResponse(
        error?.message || 'I encountered an error. Please try again.',
        false
      );

      const fallbackDisplay = normaliseAIResponse(
        error?.message || 'I encountered an error. Please try again.',
        true
      );

      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: fallbackDisplay,
          applyText: fallbackPlain,
        },
      ]);
    } finally {
      setIsLoading(false);
      if (imageToClear) URL.revokeObjectURL(imageToClear.previewUrl);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const handleApply = useCallback(
    (message: AssistantMessage, index: number) => {
      if (!onApplyContent) return;
      onApplyContent(message.applyText || stripMarkdownBold(message.content));
      setAppliedIndex(index);
    },
    [onApplyContent]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="h-full flex flex-col border-none shadow-none rounded-none">
      <CardHeader className="py-3 px-4 border-b bg-primary/5 flex flex-row items-center justify-between shrink-0">
        <CardTitle className="text-sm flex items-center gap-2 text-primary">
          <Bot className="h-4 w-4" />
          AI Consultation
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden min-h-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((m, i) => {
              const messageIndex = i;
              const messageRole = m.role;

              return (
                <div
                  key={messageIndex}
                  className={`flex flex-col ${messageRole === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                      messageRole === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {messageRole === 'ai' ? (
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none
                          [&_p]:mb-2 [&_p:last-child]:mb-0 [&_p]:leading-relaxed
                          [&_strong]:font-bold
                          [&_ul]:pl-4 [&_ul]:mb-2 [&_li]:mb-0.5
                          [&_ol]:pl-4 [&_ol]:mb-2
                          [&_a]:text-blue-600 [&_a]:underline break-words"
                      >
                        <ReactMarkdown components={{ a: AIReviewAssistantLink }}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    )}

                    {messageRole === 'ai' && messageIndex > 0 && onApplyContent && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        {appliedIndex === messageIndex ? (
                          <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                            <CheckCircle2 className="h-3 w-3" />
                            Applied to editor
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] px-2 border-primary/30 text-primary hover:bg-primary/5"
                            onClick={() => handleApply(m, messageIndex)}
                          >
                            Apply to editor
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

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

        <div className="p-3 border-t bg-background space-y-2 shrink-0">
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
              <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                {pendingImage.file.name}
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              disabled={isLoading}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
            </Button>

            <Input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your instruction, e.g. regenerate the full draft"
              className="flex-1"
              disabled={isLoading}
            />

            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              size="icon"
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIReviewAssistant;
