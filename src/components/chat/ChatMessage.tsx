import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Message } from '@/types/dermatology';
import { cn } from '@/lib/utils';
import { Bot, User, Stethoscope, X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download, RotateCw, Maximize2 } from 'lucide-react';
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
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });

  const images = message.images ?? [];

  const openLightbox = (idx: number) => {
    setLightboxIndex(idx);
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setLightboxOpen(true);
  };

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, []);

  const resetView = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  const prevImage = useCallback(() => {
    resetView();
    setLightboxIndex(i => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const nextImage = useCallback(() => {
    resetView();
    setLightboxIndex(i => (i + 1) % images.length);
  }, [images.length]);

  const zoomIn = () => setZoom(z => Math.min(parseFloat((z + 0.25).toFixed(2)), 5));
  const zoomOut = () => { setZoom(z => Math.max(parseFloat((z - 0.25).toFixed(2)), 0.25)); setPan({ x: 0, y: 0 }); };
  const rotate = () => setRotation(r => (r + 90) % 360);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: panOrigin.current.x + (e.clientX - panStart.current.x),
      y: panOrigin.current.y + (e.clientY - panStart.current.y),
    });
  };

  const handleMouseUp = () => setIsPanning(false);

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
      // Fallback for cross-origin images
      const a = document.createElement('a');
      a.href = url;
      a.download = `clinical-image-${idx + 1}.jpg`;
      a.target = '_blank';
      a.click();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-') zoomOut();
      if (e.key === 'r' || e.key === 'R') rotate();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxOpen, closeLightbox, prevImage, nextImage]);

  const formatContent = (text: string | null | undefined): string => {
    if (!text) return '';
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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
              p: ({ node, ...props }) => <p className="whitespace-pre-wrap mb-2 last:mb-0" {...props} />,
              strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
            }}
          >
            {renderedContent}
          </ReactMarkdown>

          {images.length > 0 && (
            <div className={cn("grid gap-2 mt-3", images.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
              {images.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => openLightbox(idx)}
                  className="relative group block overflow-hidden rounded-lg border border-black/10 hover:border-primary/40 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <img
                    src={url}
                    alt={`Clinical image ${idx + 1}`}
                    className="w-full h-auto object-cover max-h-64 transition-transform group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-full p-2">
                      <Maximize2 className="h-5 w-5" />
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

      {/* ── Lightbox ── */}
      {lightboxOpen && images.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col select-none">

          {/* Top toolbar */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm border-b border-white/10 flex-shrink-0">
            <span className="text-white/80 text-sm font-medium">
              Clinical Image {lightboxIndex + 1} / {images.length}
            </span>

            {/* Controls */}
            <div className="flex items-center gap-1">
              {/* Zoom out */}
              <button
                onClick={zoomOut}
                disabled={zoom <= 0.25}
                title="Zoom out  ( - )"
                className="text-white bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg p-2 transition-colors"
              >
                <ZoomOut className="h-4 w-4" />
              </button>

              {/* Zoom level — click to reset */}
              <button
                onClick={resetView}
                title="Reset view"
                className="text-white text-xs bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 min-w-[54px] transition-colors"
              >
                {Math.round(zoom * 100)}%
              </button>

              {/* Zoom in */}
              <button
                onClick={zoomIn}
                disabled={zoom >= 5}
                title="Zoom in  ( + )"
                className="text-white bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg p-2 transition-colors"
              >
                <ZoomIn className="h-4 w-4" />
              </button>

              <div className="w-px h-6 bg-white/20 mx-1" />

              {/* Rotate */}
              <button
                onClick={rotate}
                title="Rotate 90°  ( R )"
                className="text-white bg-white/10 hover:bg-white/20 rounded-lg p-2 transition-colors"
              >
                <RotateCw className="h-4 w-4" />
              </button>

              <div className="w-px h-6 bg-white/20 mx-1" />

              {/* Download */}
              <button
                onClick={() => handleDownload(images[lightboxIndex], lightboxIndex)}
                title="Download image"
                className="text-white bg-white/10 hover:bg-white/20 rounded-lg p-2 transition-colors"
              >
                <Download className="h-4 w-4" />
              </button>

              <div className="w-px h-6 bg-white/20 mx-1" />

              {/* Close */}
              <button
                onClick={closeLightbox}
                title="Close  ( Esc )"
                className="text-white bg-white/10 hover:bg-red-500/70 rounded-lg p-2 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Image area */}
          <div
            className="flex-1 flex items-center justify-center overflow-hidden relative"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
          >
            <img
              src={images[lightboxIndex]}
              alt={`Clinical image ${lightboxIndex + 1}`}
              draggable={false}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                transition: isPanning ? 'none' : 'transform 0.15s ease',
                maxWidth: '90vw',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
              }}
            />

            {/* Prev arrow */}
            {images.length > 1 && (
              <button
                onClick={prevImage}
                title="Previous  ( ← )"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:bg-black/80 rounded-full p-3 transition-colors shadow-lg"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            {/* Next arrow */}
            {images.length > 1 && (
              <button
                onClick={nextImage}
                title="Next  ( → )"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:bg-black/80 rounded-full p-3 transition-colors shadow-lg"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>

          {/* Bottom: dot indicators + keyboard hints */}
          <div className="flex flex-col items-center gap-2 py-3 bg-black/60 backdrop-blur-sm border-t border-white/10 flex-shrink-0">
            {images.length > 1 && (
              <div className="flex gap-2">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setLightboxIndex(i); resetView(); }}
                    className={cn(
                      "rounded-full transition-all",
                      i === lightboxIndex ? "bg-white w-4 h-2" : "bg-white/30 hover:bg-white/60 w-2 h-2"
                    )}
                  />
                ))}
              </div>
            )}
            <p className="text-white/30 text-[10px] tracking-wide">
              Scroll to zoom · Drag to pan · R to rotate · ← → to navigate · Esc to close
            </p>
          </div>
        </div>
      )}
    </>
  );
};
