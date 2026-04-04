import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BASE_URL } from "@/base_url";
import { Loader2, Save, RotateCcw, ShieldAlert, BookOpen, ClipboardList, Microscope, FileText, ChevronRight, LayoutGrid, UserCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface ModularPrompts {
  module1: string;
  module2: string;
  module3: string;
  module4: string;
}

export const SystemPromptEditor: React.FC = () => {
  const [prompts, setPrompts] = useState<ModularPrompts>({
    module1: '',
    module2: '',
    module3: '',
    module4: '',
  });
  const [doctorName, setDoctorName] = useState('Dr. Sasi Kiran Attili');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const fetchPrompts = async () => {
    setIsLoading(true);
    try {
      const authToken = localStorage.getItem('DoctorToken');
      const response = await fetch(`${BASE_URL}/api/system_prompt/`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      const data = await response.json();
      if (data.error === 0) {
        if (data.doctor_name) setDoctorName(data.doctor_name);
        
        try {
          const parsed = JSON.parse(data.prompt);
          setPrompts({
            module1: parsed.module1 || '',
            module2: parsed.module2 || '',
            module3: parsed.module3 || '',
            module4: parsed.module4 || '',
          });
        } catch (e) {
          setPrompts({
            module1: data.prompt,
            module2: '',
            module3: '',
            module4: '',
          });
        }
      } else {
        throw new Error(data.errorMsg || 'Failed to fetch prompts');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not load the system prompts.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const savePrompts = async () => {
    setIsSaving(true);
    try {
      const authToken = localStorage.getItem('DoctorToken');
      const response = await fetch(`${BASE_URL}/api/system_prompt/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ 
          prompt: JSON.stringify(prompts),
          doctor_name: doctorName
        }),
      });
      const data = await response.json();
      if (data.error === 0) {
        toast({
          title: "Configuration Saved",
          description: "All AI modules and clinician settings have been updated.",
        });
      } else {
        throw new Error(data.errorMsg || 'Failed to save configuration');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save the configuration.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const updateModule = (module: keyof ModularPrompts, value: string) => {
    setPrompts(prev => ({ ...prev, [module]: value }));
  };

  if (isLoading) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-navy" />
        <p className="text-xs font-bold text-navy uppercase tracking-widest animate-pulse">Syncing Engine Config</p>
      </div>
    );
  }

  const moduleConfigs = [
    { 
      id: 'module1', 
      name: 'Module 1: Educational', 
      icon: <BookOpen className="h-4 w-4" />, 
      desc: 'Free text-only education mode (Pre-payment)',
      placeholder: 'Enter educational system instructions...'
    },
    { 
      id: 'module2', 
      name: 'Module 2: Intake', 
      icon: <ClipboardList className="h-4 w-4" />, 
      desc: 'Structured data collection and privacy control',
      placeholder: 'Enter intake assistant instructions...'
    },
    { 
      id: 'module3', 
      name: 'Module 3: Analysis', 
      icon: <Microscope className="h-4 w-4" />, 
      desc: 'Internal clinical reasoning (Dermatologist-only)',
      placeholder: 'Enter clinical analysis instructions...'
    },
    { 
      id: 'module4', 
      name: 'Module 4: Final Output', 
      icon: <FileText className="h-4 w-4" />, 
      desc: 'Patient-facing assessment generator (Post-review)',
      placeholder: 'Enter final output generation instructions...'
    },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-accent-blue font-bold text-[10px] uppercase tracking-[0.2em]">
            <LayoutGrid className="h-3 w-3" />
            AI Core Specification
          </div>
          <h2 className="text-3xl font-bold text-navy tracking-tight uppercase">System Prompt Engine</h2>
          <p className="text-sm text-gray-500 max-w-2xl leading-relaxed font-medium">
            Fine-tune the behavior of each independent AI module. Changes here directly influence the dermatological reasoning and communication style of the assistant.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchPrompts} disabled={isSaving} className="h-11 border-gray-200 text-navy font-bold uppercase text-[10px] tracking-widest px-6 hover:bg-gray-50 rounded-xl">
            <RotateCcw className="h-3.5 w-3.5 mr-2" />
            Reset
          </Button>
          <Button onClick={savePrompts} disabled={isSaving} className="h-11 bg-navy hover:bg-navy/90 text-white font-bold uppercase text-[10px] tracking-widest px-8 shadow-lg shadow-navy/20 rounded-xl">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-2" />}
            Deploy Updates
          </Button>
        </div>
      </div>

      {/* Global Clinician Settings */}
      <Card className="border-none shadow-xl shadow-navy/5 bg-white overflow-hidden rounded-3xl">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-6">
          <div className="flex items-center gap-3">
            <div className="bg-navy p-2 rounded-lg text-white">
              <UserCircle className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-navy">Clinician Configuration</CardTitle>
              <CardDescription className="text-[10px] font-bold text-gray-400 uppercase">Patient-facing identity settings</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="max-w-md space-y-2">
            <Label htmlFor="doctor-name" className="text-navy font-bold uppercase text-[10px] tracking-widest ml-1">Display Name (prefixed with Dr.)</Label>
            <Input 
              id="doctor-name"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              placeholder="Dr. Sasi Kiran Attili"
              className="h-12 border-gray-200 rounded-xl focus:ring-navy focus:border-navy font-medium"
            />
            <p className="text-[10px] text-gray-400 italic ml-1">This name will be displayed to patients during the consultation.</p>
          </div>
        </CardContent>
      </Card>

      {/* Modular AI Tabs */}
      <Tabs defaultValue="module1" className="w-full">
        <TabsList className="bg-gray-100/50 p-1.5 h-auto grid grid-cols-2 md:grid-cols-4 gap-2 rounded-2xl border border-gray-200 shadow-sm mb-8">
          {moduleConfigs.map(m => (
            <TabsTrigger 
              key={m.id} 
              value={m.id}
              className="data-[state=active]:bg-white data-[state=active]:text-navy data-[state=active]:shadow-md rounded-xl py-3 px-4 flex items-center gap-2 transition-all"
            >
              <div className={cn("p-1.5 rounded-lg", prompts[m.id as keyof ModularPrompts] ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-400")}>
                {m.icon}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tight">{m.id.toUpperCase()}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {moduleConfigs.map(m => (
          <TabsContent key={m.id} value={m.id} className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <Card className="border-none shadow-2xl shadow-navy/5 overflow-hidden rounded-[32px]">
              <CardHeader className="bg-navy p-8 text-white">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-bold tracking-tight uppercase flex items-center gap-3">
                      {m.icon}
                      {m.name}
                    </CardTitle>
                    <CardDescription className="text-accent-blue font-bold text-[10px] uppercase tracking-widest opacity-90 italic">
                      {m.desc}
                    </CardDescription>
                  </div>
                  <div className="hidden sm:block">
                    <div className="bg-white/10 px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                      <ShieldAlert className="h-3.5 w-3.5 text-accent-blue" />
                      <span className="text-[10px] font-bold uppercase tracking-tighter">Production Mode</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 bg-white">
                <Textarea 
                  value={prompts[m.id as keyof ModularPrompts]}
                  onChange={(e) => updateModule(m.id as keyof ModularPrompts, e.target.value)}
                  className="w-full min-h-[600px] p-8 font-mono text-sm leading-relaxed border-none focus-visible:ring-0 resize-none bg-transparent text-gray-700"
                  placeholder={m.placeholder}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <div className="bg-white border border-gray-100 p-8 rounded-[32px] shadow-xl shadow-navy/5 flex flex-col md:flex-row gap-8 items-start">
        <div className="bg-navy/10 p-4 rounded-2xl text-navy">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div className="space-y-4 flex-1">
          <h4 className="text-lg font-bold text-navy uppercase tracking-tight">Configuration Safety Standards</h4>
          <p className="text-sm text-gray-500 leading-relaxed font-medium">
            System prompts define the core persona and safety boundaries of the AI. Ensure that updates preserve the 
            <span className="text-navy font-bold mx-1">non-diagnostic intent</span> of the educational modules and the 
            <span className="text-navy font-bold mx-1">structured clinical rigor</span> of the analysis modules.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {[
              'Maintain textbook-style neutral tone',
              'Keep safety prohibitions intact',
              'Align triggers with system spec'
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                <ChevronRight className="h-3 w-3 text-accent-blue" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
