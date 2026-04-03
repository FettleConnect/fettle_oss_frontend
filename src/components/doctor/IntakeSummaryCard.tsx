import React, { useState, useCallback, useEffect } from 'react';
import { IntakeData } from '@/types/dermatology';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Stethoscope, MapPin, Pill, ClipboardList, FileText, X, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      <Card className="bg-white border-dashed border-gray-200">
        <CardContent className="flex flex-col items-center justify-center py-12 text-gray-400">
          <FileText className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-xs font-bold uppercase tracking-widest">Awaiting Intake Data</p>
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
      <Card className="border-none shadow-xl shadow-navy/5 overflow-hidden rounded-2xl">
        <CardHeader className="py-4 bg-navy text-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest">
              <ClipboardList className="h-4 w-4 text-accent-blue" />
              Clinical Intake Summary
            </CardTitle>
            <Badge variant="outline" className="text-[10px] uppercase border-white/20 text-white bg-white/5">Verified Patient Report</Badge>
          </div>
        </CardHeader>
        <CardContent className="py-6 grid gap-6 md:grid-cols-2 bg-white">
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <div className="p-1.5 rounded-md bg-gray-50">
                    <Icon className="h-3 w-3 text-navy" />
                  </div>
                  {item.label}
                </div>
                <div className="text-sm font-medium leading-relaxed text-gray-700 bg-gray-50/50 p-3 rounded-xl border border-gray-100 hover:border-navy/10 transition-colors">
                  {String(item.value || "Not reported")}
                </div>
              </div>
            );
          })}

          {images.length > 0 && (
            <div className="col-span-full mt-2">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                <span>Clinical Evidence ({images.length})</span>
                <span className="text-navy opacity-60">Visual Assets</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => openLightbox(i)}
                    className="relative flex-shrink-0 group overflow-hidden rounded-xl border border-gray-100 shadow-sm"
                  >
                    <img
                      src={img}
                      alt={`Patient upload ${i + 1}`}
                      className="h-28 w-28 object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-navy/40 backdrop-blur-[2px]">
                      <div className="bg-white/90 p-2 rounded-full text-navy shadow-lg">
                        <ChevronRight className="h-4 w-4" />
                      </div>
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
        <div className="fixed inset-0 z-[100] bg-navy/95 backdrop-blur-md flex items-center justify-center p-4" onClick={closeLightbox}>
          <div className="absolute top-6 right-6 flex gap-3" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon" onClick={() => handleDownload(images[lightboxIndex], lightboxIndex)} className="text-white hover:bg-white/10 rounded-full h-12 w-12"><Download className="h-6 w-6" /></Button>
            <Button variant="ghost" size="icon" onClick={closeLightbox} className="text-white hover:bg-red-500/20 rounded-full h-12 w-12"><X className="h-6 w-6" /></Button>
          </div>
          <img src={images[lightboxIndex]} alt={`Clinical image ${lightboxIndex + 1}`} onClick={e => e.stopPropagation()} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10" />
          {images.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); prevImage(); }} className="absolute left-6 top-1/2 -translate-y-1/2 text-white bg-white/5 hover:bg-white/15 backdrop-blur-sm rounded-full p-4 transition-all"><ChevronLeft className="h-8 w-8" /></button>
              <button onClick={e => { e.stopPropagation(); nextImage(); }} className="absolute right-6 top-1/2 -translate-y-1/2 text-white bg-white/5 hover:bg-white/15 backdrop-blur-sm rounded-full p-4 transition-all"><ChevronRight className="h-8 w-8" /></button>
            </>
          )}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full text-white text-xs font-bold uppercase tracking-widest">
            Evidence {lightboxIndex + 1} of {images.length}
          </div>
        </div>
      )}
    </>
  );
};
