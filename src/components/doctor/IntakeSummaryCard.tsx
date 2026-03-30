import React, { useState, useCallback, useEffect } from 'react';
import { IntakeData } from '@/types/dermatology';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Stethoscope, MapPin, Pill, ClipboardList, FileText, X, Download, ChevronLeft, ChevronRight } from 'lucide-react';

interface IntakeSummaryCardProps {
  intakeData?: IntakeData;
}

export const IntakeSummaryCard: React.FC<IntakeSummaryCardProps> = ({ intakeData }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const images = Array.isArray(intakeData?.images) ? intakeData.images : [];

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

  if (!intakeData) {
    return (
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mb-2 opacity-50" />
          <p>No intake data collected yet.</p>
        </CardContent>
      </Card>
    );
  }

  const items = [
    { icon: Clock, label: 'Duration', value: intakeData.duration },
    { icon: Stethoscope, label: 'Symptoms', value: intakeData.symptoms },
    { icon: MapPin, label: 'Location', value: intakeData.location },
    { icon: Pill, label: 'Medications', value: intakeData.medicationsTried || (intakeData as any).medications_tried },
    { icon: ClipboardList, label: 'Prior Diagnoses', value: intakeData.priorDiagnoses || (intakeData as any).prior_diagnoses },
    { icon: FileText, label: 'Health History', value: intakeData.relevantHealthHistory || (intakeData as any).relevant_health_history },
  ];

  return (
    <>
      <Card className="border-l-4 border-l-primary shadow-sm">
        <CardHeader className="py-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Medical Case Summary
            </CardTitle>
            <Badge variant="outline" className="bg-background">Patient Report</Badge>
          </div>
        </CardHeader>
        <CardContent className="py-4 grid gap-4 md:grid-cols-2">
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="text-sm font-medium leading-relaxed bg-muted/30 p-2 rounded-md border border-transparent hover:border-border transition-colors">
                  {String(item.value || "Not reported")}
                </div>
              </div>
            );
          })}

          {images.length > 0 && (
            <div className="col-span-full mt-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Attached Images ({images.length}) — <span className="normal-case text-primary">click to open</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => openLightbox(i)}
                    className="relative flex-shrink-0 group focus:outline-none focus:ring-2 focus:ring-primary rounded-md"
                  >
                    <img
                      src={img}
                      alt={`Patient upload ${i + 1}`}
                      className="h-24 w-24 object-cover rounded-md border shadow-sm transition-opacity group-hover:opacity-80"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-md">
                      <span className="text-white text-xs font-medium">Open</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lightbox */}
      {lightboxOpen && images.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Top right buttons */}
          <div
            className="absolute top-4 right-4 flex gap-2"
            onClick={e => e.stopPropagation()}
          >
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

          {/* Counter */}
          {images.length > 1 && (
            <div className="absolute top-4 left-4 text-white/70 text-sm">
              {lightboxIndex + 1} / {images.length}
            </div>
          )}

          {/* Image */}
          <img
            src={images[lightboxIndex]}
            alt={`Clinical image ${lightboxIndex + 1}`}
            onClick={e => e.stopPropagation()}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />

          {/* Prev / Next */}
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
