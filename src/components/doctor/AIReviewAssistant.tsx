import React, { useState, useRef, useCallback, useEffect } from 'react';
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

const SECTION_TITLES = [
  'Most Consistent With',
  'Close Differentials',
  'Morphologic Justification',
  'Educational Treatment Framework',
  'Investigations Commonly Considered',
  'References',
];

const FINAL_LINE = "You're welcome to ask follow-up questions.";

function cleanBody(text: string): string {
  return (text || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeHeading(title: string): string {
  return title.trim().toLowerCase();
}

function isPlaceholder(text: string): boolean {
  const v = (text || '').trim().toLowerCase();
  if (!v) return true;

  const placeholders = [
    'type here',
    'enter response',
    'write response',
    'draft response',
    'assessment',
    'pending',
    'tbd',
    'todo',
    'n/a',
    'na',
    '-',
    '--',
  ];

  return placeholders.some((p) => v === p || v.includes(p));
}

function generateFallbackContent(section: string): string {
  switch (section) {
    case 'Most Consistent With':
      return 'Preliminary clinical impression based on available intake data suggests a dermatologic condition requiring further clinical correlation.';
    case 'Close Differentials':
      return 'Differential diagnoses may include inflammatory, infectious, or allergic dermatologic conditions depending on presentation.';
    case 'Morphologic Justification':
      return 'Assessment is based on the provided history and any available images. Morphology suggests a localised dermatologic process requiring clinical correlation.';
    case 'Educational Treatment Framework':
      return 'General supportive care, avoidance of irritants, and clinically appropriate dermatologic management may be considered after physician review.';
    case 'Investigations Commonly Considered':
      return 'Further evaluation may include dermatologic examination, bedside tests, laboratory workup, or biopsy if clinically indicated.';
    case 'References':
      return 'Standard dermatology educational references and clinical guidelines (NHS, DermNet NZ, BAD, CDC).';
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
    { patterns: ['Diagnosis', 'Most Consistent With'], target: 'Most Consistent With' },
    { patterns: ['Differential Diagnoses', 'Close Differentials', 'Differentials'], target: 'Close Differentials' },
    { patterns: ['Technical Justification', 'Morphologic Justification', 'Justification'], target: 'Morphologic Justification' },
    { patterns: ['Prescription Regimen', 'Educational Treatment Framework', 'Treatment Framework'], target: 'Educational Treatment Framework' },
    { patterns: ['Investigations', 'Investigations Commonly Considered'], target: 'Investigations Commonly Considered' },
    { patterns: ['Educational References', 'References'], target: 'References' },
  ];

  const sectionHeaders = mappings.flatMap((m) => m.patterns.map(escapeRegex)).join('|');
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

    const mapping = mappings.find((m) =>
      m.patterns.some((p) => p.toLowerCase() === current.title.toLowerCase())
    );

    if (mapping && body) {
      sections[normalizeHeading(mapping.target)] = body;
    }
  }

  return sections;
}

function buildStructuredOutput(sections: Record<string, string>): string {
  const content = SECTION_TITLES.map((title) => {
    const key = normalizeHeading(title);
    const body = cleanBody(sections[key] || '') || generateFallbackContent(title);
    return `${title}\n\n${body}`.trim();
  }).join('\n\n');

  const cleaned = cleanBody(content);
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

function normaliseAIResponse(raw: string): string {
  const text = cleanBody(raw);
  if (!text || text.length < 20) return '';

  let sections = extractStructuredSections(text);
  if (Object.keys(sections).length === 0) sections = extractLegacyNumberedSections(text);
  if (Object.keys(sections).length === 0) {
    sections = { [normalizeHeading('Most Consistent With')]: text };
  }

  const stripped: Record<string, string> = {};
  for (const [key, body] of Object.entries(sections)) {
    stripped[key] = stripDosingInfo(body);
  }

  return buildStructuredOutput(stripped);
}

function smartMerge(existingDraft: string, aiResponse: string): string {
  const existingSections = (() => {
    let s = extractStructuredSections(existingDraft);
    if (Object.keys(s).length === 0) s = extractLegacyNumberedSections(existingDraft);
    return s;
  })();

  const aiSections = (() => {
    let s = extractStructuredSections(aiResponse);
    if (Object.keys(s).length === 0) s = extractLegacyNumberedSections(aiResponse);
    return s;
  })();

  const merged: Record<string, string> = {};

  for (const title of SECTION_TITLES) {
    const key = normalizeHeading(title);
    const existing = cleanBody(existingSections[key] || '');
    const ai = cleanBody(aiSections[key] || '');

    if (ai && !isPlaceholder(ai)) {
      merged[key] = ai;
    } else if (existing && !isPlaceholder(existing)) {
      merged[key] = existing;
    } else {
      merged[key] = generateFallbackContent(title);
    }
  }

  return buildStructuredOutput(merged);
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
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([
    {
      role: 'ai',
      content:
        "I'm ready to assist with this case. Type your instruction below, for example:\n\n- Revise the diagnosis wording\n- Strengthen the differential section\n- Improve morphologic justification\n- Make the treatment framework more concise\n- Add better references\n\nUse the **Apply to editor** button under any response to merge the changes into the Assessment editor.",
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appliedIndex, setAppliedIndex] = useState<number | null>(null);
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefillMessage && prefillMessage.trim()) {
      setInput(prefillMessage.trim());
      onPrefillConsumed?.();
      setTimeout(() => inputRef.current?.focus(), 80);
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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsLoading(true);
    setAppliedIndex(null);

    const imageToClear = pendingImage;
    setPendingImage(null);
    setImageError(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);

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
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok || data?.error === 1) {
        throw new Error(data?.errorMsg || 'Failed to get AI response');
      }

      const rawAiContent: string =
        data.result?.trim() || data.response?.trim() || data.message?.trim() || '';

      const aiContent =
        rawAiContent && rawAiContent.trim().length > 20
          ? normaliseAIResponse(rawAiContent)
          : "I couldn't generate a structured revision for that request. Please try a more specific instruction such as 'improve diagnosis wording' or 'rewrite references section only'.";

      setMessages((prev) => [...prev, { role: 'ai', content: aiContent }]);
    } catch (error: any) {
      console.error('Error consulting AI:', error);

      const message =
        error?.name === 'AbortError'
          ? 'AI request timed out. Please try again.'
          : error?.message || 'I encountered an error. Please ensure the backend is running and try again.';

      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: message,
        },
      ]);
    } finally {
      window.clearTimeout(timeoutId);
      setIsLoading(false);
      if (imageToClear) URL.revokeObjectURL(imageToClear.previewUrl);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleApply = useCallback(
    (content: string, index: number) => {
      if (!onApplyContent) return;
      const merged = smartMerge(editorContent || '', content);
      onApplyContent(merged);
      setAppliedIndex(index);
    },
    [editorContent, onApplyContent]
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
                        [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1
                        [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1
                        [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1
                        [&_p]:mb-2 [&_p:last-child]:mb-0 [&_p]:leading-relaxed
                        [&_ul]:pl-4 [&_ul]:mb-2 [&_li]:mb-0.5
                        [&_ol]:pl-4 [&_ol]:mb-2 [&_strong]:font-semibold
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
                      {appliedIndex === i ? (
                        <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                          <CheckCircle2 className="h-3 w-3" />
                          Applied to editor
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] px-2 border-primary/30 text-primary hover:bg-primary/5"
                          onClick={() => handleApply(m.content, i)}
                        >
                          Apply to editor
                        </Button>
                      )}
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
              className="h-9 w-9 shrink-0"
              disabled={isLoading}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
            </Button>

            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your instruction, e.g. revise diagnosis or improve differentials..."
              className="flex-1 h-9 text-xs"
              disabled={false}
              autoComplete="off"
            />

            <Button
              type="button"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={isLoading || !input.trim()}
              onClick={handleSend}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
