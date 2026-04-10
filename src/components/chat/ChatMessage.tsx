import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { Message } from '@/types/dermatology';
import { cn } from '@/lib/utils';
import { Bot, User, Stethoscope, X, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

const MODULE_4_TITLES = [
  'Most Consistent With',
  'Close Differentials',
  'Morphologic Justification',
  'Educational Treatment Framework',
  'Typical Course and Prognosis',
  'When In-Person Evaluation Is Considered',
  'Educational References',
];

const MODULE_3_TITLES = [
  'Primary Likely Diagnosis',
  'Differential Diagnoses (Ranked)',
  'Differential Diagnoses',
  'Key Morphologic / Clinical Features',
  'Key Morphologic Features',
  'Red Flags',
  'Suggested Investigations',
  'Diagnostic Confidence',
];

const ALL_SECTION_TITLES = [...MODULE_4_TITLES, ...MODULE_3_TITLES];

interface MarkdownProps {
  children?: ReactNode;
  href?: string;
}

const MarkdownP = ({ children }: MarkdownProps) => (
  <p className="whitespace-pre-wrap mb-2 last:mb-0">{children}</p>
);

// inline style — cannot be overridden by any CSS class or reset
const MarkdownStrong = ({ children }: MarkdownProps) => (
  <strong style={{ fontWeight: 700 }}>{children}</strong>
);

const BoldHeading = ({ children }: MarkdownProps) => (
  <p style={{ fontWeight: 700 }} className="text-sm mt-3 mb-1">
    {children}
  </p>
);

const MarkdownUl = ({ children }: MarkdownProps) => (
  <ul className="list-disc list-outside pl-5 mb-2 space-y-1">{children}</ul>
);

const MarkdownOl = ({ children }: MarkdownProps) => (
  <ol className="list-decimal list-outside pl-5 mb-2 space-y-1">{children}</ol>
);

const MarkdownLi = ({ children }: MarkdownProps) => (
  <li className="text-sm leading-relaxed">{children}</li>
);

const MarkdownA = ({ href, children }: MarkdownProps) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="text-blue-600 underline underline-offset-2 font-semibold hover:text-blue-800 transition-colors cursor-pointer"
  >
    {children}
  </a>
);

const DoctorAvatar: React.FC = () => {
  const [imgFailed, setImgFailed] = React.useState(false);
  if (imgFailed) {
    return <Stethoscope className="h-3.5 w-3.5 text-white" />;
  }
  return (
    <img
      src="/doctor-photo.jpg"
      alt="Dr. Sasi Kiran Attili"
      className="w-6 h-6 rounded-full object-cover object-top"
      onError={() => setImgFailed(true)}
    />
  );
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isStreaming }) => {
  const isPatient = message.role === 'patient';
  const isDoctor = message.role === 'doctor';
  const isSystem = message.role === 'system';
  const isAI =
    message.role === 'ai' ||
    message.role === 'AI' ||
    message.role === 'assistant';

  const shouldFormat = !isPatient && !isSystem;

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const images = [...new Set(message.images ?? [])];

  const openLightbox = (idx: number) => {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  const prevImage = useCallback(() => {
    if (images.length === 0) return;
    setLightboxIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const nextImage = useCallback(() => {
    if (images.length === 0) return;
    setLightboxIndex((i) => (i + 1) % images.length);
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

  const linkifyUrls = (text: string): string => {
    return text.replace(/(?<!\]\()(https?:\/\/[^\s)\]]+)/g, (url) => `[${url}](${url})`);
  };

  const formatContent = (text: string | null | undefined): string => {
    if (!text) return '';
    const unescaped = text.replace(/\\n\\n/g, '\n\n').replace(/\\n/g, '\n');
    const normalized = unescaped.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const withLinks = linkifyUrls(normalized);

    return withLinks
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.length < 2) return line;

        // Never touch numbered list items
        if (/^\d+\.\s/.test(trimmed)) return line;

        // Already a markdown heading — leave it
        if (trimmed.startsWith('#')) return trimmed;

        // Strip ALL ** markers and trailing colon to get the bare title.
        // This handles: **Title**, **Title:**, **Title:**  (all backend variants)
        const stripped = trimmed
          .replace(/\*\*/g, '')   // remove all ** markers
          .replace(/:$/, '')      // remove trailing colon
          .trim();

        // Match known section titles → emit as ### so BoldHeading renders bold
        const isHeader = ALL_SECTION_TITLES.some(
          (title) =>
            stripped.toLowerCase() === title.toLowerCase() ||
            stripped.toLowerCase().startsWith(title.toLowerCase() + ':')
        );

        if (isHeader) {
          return `### ${stripped}`;
        }

        // Inline bold that isn't a section title — return trimmed to avoid
        // ReactMarkdown misreading leading whitespace as indented code
        if (trimmed.startsWith('**')) return trimmed;

        // Short Title Case label lines → inline bold
        if (/^[A-Z][A-Za-z\s\/()\-]+:?\s*$/.test(trimmed)) {
          return `**${trimmed}**`;
        }

        return line;
      })
      .join('\n');
  };

  const getRoleLabel = () => {
    if (message.senderName) return message.senderName;
    if (isPatient) return 'Patient';
    if (isDoctor) return 'Dr. Sasi Kiran Attili';
    if (isSystem) return 'Notification';
    return 'Dermatological AI';
  };

  const getRoleIcon = () => {
    if (isPatient) return <User className="h-3 w-3" />;
    if (isDoctor) return <DoctorAvatar />;
    return <Bot className="h-3 w-3" />;
  };

  const getBubbleColors = () => {
    if (isPatient) return 'bg-white border border-gray-200 text-gray-800 shadow-sm';
    if (isDoctor) return 'bg-navy text-white shadow-lg shadow-navy/20';
    if (isSystem) return 'bg-[#fdf5e6] text-gray-700 border border-[#f5deb3]/50';
    return 'bg-accent-blue/10 border border-accent-blue/20 text-gray-800';
  };

  const getLabelColors = () => {
    if (isPatient) return 'text-gray-500';
    if (isDoctor) return 'text-navy font-bold uppercase tracking-widest';
    if (isSystem) return 'text-amber-700 font-bold uppercase tracking-widest';
    return 'text-accent-blue font-bold uppercase tracking-widest';
  };

  if (isSystem) {
    return (
      <div className="flex flex-col items-center gap-2 w-full my-6">
        <div
          className={cn(
            'rounded-full px-6 py-2 text-[10px] text-center font-bold uppercase tracking-widest max-w-[90%]',
            getBubbleColors()
          )}
        >
          {message.content}
        </div>
      </div>
    );
  }

  const cleanContent = (message.content || '')
    .replace(/^INTAKE_COMPLETE\s*/gm, '')
    .replace(
      /Thank you for the information\.\s*\nINTAKE_COMPLETE/g,
      'Thank you for the information.'
    )
    .trim();

  const renderedContent = shouldFormat
    ? formatContent(cleanContent)
    : cleanContent || ' ';

  const mdComponents = {
    p: MarkdownP,
    strong: MarkdownStrong,
    h1: BoldHeading,
    h2: BoldHeading,
    h3: BoldHeading,
    h4: BoldHeading,
    h5: BoldHeading,
    h6: BoldHeading,
    ul: MarkdownUl,
    ol: MarkdownOl,
    li: MarkdownLi,
    a: MarkdownA,
  };

  const formattedTime = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <>
      <div
        className={cn(
          'flex flex-col gap-2 max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-500',
          isPatient ? 'ml-auto items-end' : 'mr-auto items-start'
        )}
      >
        {isDoctor ? (
          <a
            href="https://www.onlineskinspecialist.com/consultant-dermatologist/"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center gap-2 text-[10px] hover:opacity-75 transition-opacity cursor-pointer',
              getLabelColors()
            )}
          >
            <div className="overflow-hidden flex items-center justify-center rounded-full w-6 h-6 border border-navy/20">
              {getRoleIcon()}
            </div>
            <span>{getRoleLabel()}</span>
          </a>
        ) : (
          <div className={cn('flex items-center gap-2 text-[10px]', getLabelColors())}>
            <div
              className={cn(
                'overflow-hidden flex items-center justify-center',
                'p-1 rounded-md',
                isAI ? 'bg-accent-blue text-white' : 'bg-gray-100 text-gray-500'
              )}
            >
              {getRoleIcon()}
            </div>
            <span>{getRoleLabel()}</span>
          </div>
        )}

        <div
          className={cn(
            'rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm',
            getBubbleColors(),
            isPatient ? 'rounded-tr-none' : 'rounded-tl-none'
          )}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {renderedContent}
          </ReactMarkdown>

          {images.length > 0 && (
            <div
              className={cn(
                'grid gap-3 mt-4',
                images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
              )}
            >
              {images.map((url, idx) => (
                <div
                  key={idx}
                  className="group relative overflow-hidden rounded-xl border border-black/5 aspect-square"
                >
                  <img
                    src={url}
                    alt={`Clinical image ${idx + 1}`}
                    onClick={() => openLightbox(idx)}
                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
                    <div className="bg-white/90 p-2 rounded-full text-navy shadow-lg">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5 align-middle" />
          )}
        </div>

        {formattedTime && (
          <span className="text-[10px] text-gray-400 font-medium px-1 uppercase tracking-tighter">
            {formattedTime}
          </span>
        )}
      </div>

      {lightboxOpen && images.length > 0 && (
        <div
          className="fixed inset-0 z-[100] bg-navy/95 backdrop-blur-md flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <div
            className="absolute top-6 right-6 flex gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => handleDownload(images[lightboxIndex], lightboxIndex)}
              className="text-white hover:bg-white/10 rounded-full h-12 w-12 flex items-center justify-center"
            >
              <Download className="h-6 w-6" />
            </button>
            <button
              onClick={closeLightbox}
              className="text-white hover:bg-red-500/20 rounded-full h-12 w-12 flex items-center justify-center"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <img
            src={images[lightboxIndex]}
            alt={`Clinical image ${lightboxIndex + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10"
          />

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
                className="absolute left-6 top-1/2 -translate-y-1/2 text-white bg-white/5 hover:bg-white/15 backdrop-blur-sm rounded-full p-4 transition-all"
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
                className="absolute right-6 top-1/2 -translate-y-1/2 text-white bg-white/5 hover:bg-white/15 backdrop-blur-sm rounded-full p-4 transition-all"
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            </>
          )}

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full text-white text-xs font-bold uppercase tracking-widest">
            Image {lightboxIndex + 1} of {images.length}
          </div>
        </div>
      )}
    </>
  );
};
