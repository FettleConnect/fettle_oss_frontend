import React, { useState } from 'react';
import { Message } from '@/types/dermatology';
import { cn } from '@/lib/utils';
import { Bot, User, Stethoscope, X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [zoom, setZoom] = useState(1);

  const openLightbox = (idx: number) => {
    setLightboxIndex(idx);
    setZoom(1);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setZoom(1);
  };

  const prevImage = () => {
    setZoom(1);
    setLightboxIndex(i => (i - 1 + (message.images?.length ?? 1)) % (message.images?.length ?? 1));
  };

  const nextImage = () => {
    setZoom(1);
    setLightboxIndex(i => (i + 1) % (message.images?.length ?? 1));
  };

  const zoomIn = () => setZoom(z => Math.min(z + 0.5, 4));
  const zoomOut = () => setZoom(z => Math.max(z - 0.5, 0.5));

  const formatContent = (text: string | null | undefined): string => {
    if (!text) return '';
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return normalized
      .split('\n')
      .map(line => {
        const trimmed = line.trimEnd();
        const content = trimmed.trim();

        if (content.length < 2) return line;

        // Already has markdown bold — skip to avoid double-wrapping
        if (content.startsWith('**')) return line;

        // Bold standalone headings with nothing after the colon (or no colon)
        if (/^(\d+\.\s+)?[A-Z][A-Za-z\s\/\-\(\)]+:?\s*$/.test(content)) {
          return `**${content}**`;
        }

        // Bold full lines that end with a colon — section intro headers
        if (/^[A-Z].+:\s*$/.test(content)) {
          return `**${content}**`;
        }

        // Bold only the leading label on key-value lines
        if (/^[A-Z][^.!?\n]*:\s+\S/.test(content)) {
          return line.replace(/^([^:]+:)/, '**$1**');
        }

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
            }}
          >
            {renderedContent}
          </ReactMarkdown>

          {message.images && message.images.length > 0 && (
            <div className={cn("grid gap-2 mt-3", message.images.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
              {message.images.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => openLightbox(idx)}
                  className="relative group block overflow-hidden rounded-lg border border-black/10 hover:border-primary/40 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <img
                    src={url}
                    alt={`Attached clinical image ${idx + 1}`}
                    className="w-full h-auto object-cover max-h-64 transition-transform group-hover:scale-[1.02]"
                  />
                  {/* Zoom hint overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-full p-2">
                      <ZoomIn className="h-5 w-5" />
                    </div>
                  </div>
                </button>
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

      {/* Lightbox */}
      {lightboxOpen && message.images && message.images.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Top bar */}
          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-black/40"
            onClick={e => e.stopPropagation()}
          >
            <span className="text-white text-sm font-medium">
              Clinical Image {lightboxIndex + 1} of {message.images.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={zoomOut}
                disabled={zoom <= 0.5}
                className="text-white bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-full p-1.5 transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <span className="text-white text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button
                onClick={zoomIn}
                disabled={zoom >= 4}
                className="text-white bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-full p-1.5 transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                onClick={closeLightbox}
                className="text-white bg-white/10 hover:bg-white/20 rounded-full p-1.5 ml-2 transition-colors"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Image */}
          <div
            className="overflow-auto max-w-full max-h-[80vh] flex items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={message.images[lightboxIndex]}
              alt={`Clinical image ${lightboxIndex + 1}`}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.2s ease' }}
              className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg shadow-2xl"
            />
          </div>

          {/* Prev / Next arrows */}
          {message.images.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); prevImage(); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/70 rounded-full p-2 transition-colors"
                title="Previous image"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); nextImage(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/70 rounded-full p-2 transition-colors"
                title="Next image"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Dot indicators */}
          {message.images.length > 1 && (
            <div className="absolute bottom-4 flex gap-2" onClick={e => e.stopPropagation()}>
              {message.images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setLightboxIndex(i); setZoom(1); }}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    i === lightboxIndex ? "bg-white" : "bg-white/40 hover:bg-white/70"
                  )}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};
