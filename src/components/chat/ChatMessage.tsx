import React, { useState, useEffect, useCallback } from 'react';
import { Message } from '@/types/dermatology';
import { cn } from '@/lib/utils';
import { Bot, User, Stethoscope, X, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isStreaming }) => {
  const isPatient = message.role === 'patient';
  const isDoctor = message.role === 'doctor';
  const isSystem = message.role === 'system';
  const isAI = message.role === 'ai';

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const images = message.images ?? [];

  const openLightbox = (idx: number) => {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);
  const prevImage = useCallback(() => {
    setLightboxIndex(i => (i - 1 + images.length) % images.length);
  }, [images.length]);
  const nextImage = useCallback(() => {
    setLightboxIndex(i => (i + 1) % images.length);
  }, [images.length]);

  const handleDownload = async (url: string, idx: number) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = blob.type.split('/')[1] ?? 'jpg';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `clinical-image-${idx + 1}.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      const a = document.createElement('a');
      a.href = url;
      a.download = `clinical-image-${idx + 1}.jpg`;
      a.target = '_blank';
      a.click();
    }
  };

  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxOpen, closeLightbox, prevImage, nextImage]);

  // Strip the "Note: Free educational mode..." disclaimer from AI message content
  // It is shown in the pinned bar in ChatContainer instead
  const stripNote = (text: string): string => {
    const noteIndex = text.indexOf('Note: Free educational mode');
    if (noteIndex !== -1) return text.slice(0, noteIndex).trimEnd();
    return text
      .split('\n')
      .filter(line => {
        const l = line.toLowerCase();
        return !(
          l.startsWith('note:') &&
          (l.includes('free educational') || l.includes('text-only') || l.includes('image uploads'))
        );
      })
      .join('\n')
      .trimEnd();
  };

  const formatContent = (text: string | null | undefined): string => {
    if (!text) return '';
    const stripped = isAI ? stripNote(text) : text;
    const normalized = stripped.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return normalized
      .split('\n')
      .map(line => {
        const trimmed = line.trimEnd();
        const content = trimmed.trim();
        if (content.length < 2) return line;
        if (content.startsWith('**')) return line;
        if (/^(\d+\.\s+)?[A-Z][A-Za-z\s\/\-\(\)]+:?\s*$/.test(content)) return `**${content}**`;
        if (/^[A-Z].+:\s*$/.test(content)) return `**${content}**`;
        if (/^[A-Z][^.!?\n]*:\s+\S/.test(content)) return line.replace(/^([^:]+:)/, '**$1**');
        return line;
      })
      .join('\n');
  };

  const getRoleLabel = () => {
    if (message.senderName) return message.senderName;
    if (isPatient) return 'You';
    if (isDoctor) return 'Doctor';
    if (isSystem) return 'System Notification';
    return 'AI Educational Assistant';
  };

  const getRoleIcon = () => {
    if (isPatient) return <User className="h-4 w-4" />;
    if (isDoctor) return <Stethoscope className="h-4 w-4" />;
    return <Bot className="h-4 w-4" />;
  };

  const getBubbleColors = () => {
    if (isPatient) return 'bg-muted text-foreground';
    if (isDoctor) return 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100';
    if (isSystem) return 'bg-blue-50 text-blue-900 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-100 dark:border-blue-900/30';
    return 'bg-primary/10 text-foreground';
  };

  const getLabelColors = () => {
    if (isPatient) return 'text-muted-foreground';
    if (isDoctor) return 'text-green-700 dark:text-green-300';
    if (isSystem) return 'text-blue-700 dark:text-blue-300';
    return 'text-primary';
  };

  if (isSystem) {
    return (
      <div className="flex flex-col items-center gap-2 w-full my-4">
        <div className={cn('rounded-lg px-6 py-3 text-sm text-center font-medium max-w-[90%]', getBubbleColors())}>
          {message.content ?? ''}
        </div>
      </div>
    );
  }

  const safeContent = message.content ?? '';
  const renderedContent = (isDoctor || isAI) ? formatContent(safeContent) : safeContent;

  return (
    <>
      <div className={cn('flex flex-col gap-1 max-w-[85%]', isPatient ? 'ml-auto items-end' : 'mr-auto items-start')}>
        <div className={cn('flex items-center gap-1.5 text-xs font-medium', getLabelColors())}>
          {getRoleIcon()}
          <span>{getRoleLabel()}</span>
        </div>
        <div className={cn(
          'rounded-2xl px-4 py-2.5 text-sm leading-relaxed max-w-none',
          getBubbleColors(),
          isPatient ? 'rounded-br-md' : 'rounded-bl-md'
        )}>
          <ReactMarkdown
            components={{
              p: ({ node, ...props }) => (
                <p className="whitespace-pre-wrap mb-2 last:mb-0" {...props} />
              ),
              strong: ({ node, ...props }) => (
                <strong className="font-bold" {...props} />
              ),
              a: ({ node, href, children, ...props }) => (
                
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                  {...props}
                >
                  {children}
                </a>
              ),
            }}
          >
            {renderedContent}
          </ReactMarkdown>

          {images.length > 0 && (
            <div className={cn("grid gap-2 mt-3", images.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
              {images.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`Clinical image ${idx + 1}`}
                  onClick={() => openLightbox(idx)}
                  className="w-full h-auto object-cover max-h-64 rounded-lg border border-black/10 cursor-pointer hover:opacity-90 transition-opacity"
                />
              ))}
            </div>
          )}

          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5 align-middle" />
          )}
        </div>

        <span className="text-xs text-muted-foreground">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {lightboxOpen && images.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={closeLightbox}>
          <div className="absolute top-4 right-4 flex gap-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => handleDownload(images[lightboxIndex], lightboxIndex)}
              className="text-white bg-white/10 hover:bg-white/25 rounded-full p-2 transition-colors"
              title="Download"
            >
              <Download className="h-5 w-5" />
            </button>
            <button
              onClick={closeLightbox}
              className="text-white bg-white/10 hover:bg-red-500/70 rounded-full p-2 transition-colors"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <img
            src={images[lightboxIndex]}
            alt={`Clinical image ${lightboxIndex + 1}`}
            onClick={e => e.stopPropagation()}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />

          {images.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); prevImage(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/70 rounded-full p-2 transition-colors"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); nextImage(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/70 rounded-full p-2 transition-colors"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
};
