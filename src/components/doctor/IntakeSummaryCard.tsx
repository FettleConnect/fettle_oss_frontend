import React from 'react';
import { IntakeData } from '@/types/dermatology';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Stethoscope, MapPin, Pill, ClipboardList, FileText } from 'lucide-react';

interface IntakeSummaryCardProps {
  intakeData?: IntakeData;
}

export const IntakeSummaryCard: React.FC<IntakeSummaryCardProps> = ({ intakeData }) => {
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
        {items.map((item, index) => (
          <div key={index} className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </div>
            <div className="text-sm font-medium leading-relaxed bg-muted/30 p-2 rounded-md border border-transparent hover:border-border transition-colors">
              {item.value || "Not reported"}
            </div>
          </div>
        ))}
        {intakeData.images && intakeData.images.length > 0 && (
          <div className="col-span-full mt-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Attached Images ({intakeData.images.length})
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {intakeData.images.map((img, i) => (
                <img 
                  key={i} 
                  src={img} 
                  alt={`Patient upload ${i+1}`} 
                  className="h-24 w-24 object-cover rounded-md border shadow-sm cursor-zoom-in hover:opacity-90 transition-opacity"
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
