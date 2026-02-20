import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { BASE_URL } from "@/base_url";
import { Loader2, Save, RotateCcw, ShieldAlert } from "lucide-react";

export const SystemPromptEditor: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const fetchPrompt = async () => {
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
        setPrompt(data.prompt);
      } else {
        throw new Error(data.errorMsg || 'Failed to fetch prompt');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not load the master prompt.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const savePrompt = async () => {
    setIsSaving(true);
    try {
      const authToken = localStorage.getItem('DoctorToken');
      const response = await fetch(`${BASE_URL}/api/system_prompt/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (data.error === 0) {
        toast({
          title: "Success",
          description: "Master Prompt updated successfully.",
        });
      } else {
        throw new Error(data.errorMsg || 'Failed to save prompt');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save the master prompt.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    fetchPrompt();
  }, []);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Master Prompt</h2>
          <p className="text-muted-foreground">
            Configure the global system instructions for the AI dermatology assistant.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchPrompt} disabled={isSaving}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={savePrompt} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      <Card className="flex-1 min-h-[500px] border-amber-200 bg-amber-50/10">
        <CardHeader className="pb-3 border-b border-amber-100 bg-amber-50/30">
          <CardTitle className="text-sm font-semibold flex items-center text-amber-800">
            <ShieldAlert className="h-4 w-4 mr-2" />
            Core System Instructions (v5.2+)
          </CardTitle>
          <CardDescription className="text-amber-700/70">
            Changes applied here take effect immediately for all new conversations and state transitions.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 h-[calc(100%-80px)]">
          <Textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full h-full min-h-[500px] p-6 font-mono text-sm leading-relaxed border-none focus-visible:ring-0 resize-none bg-transparent"
            placeholder="Paste system instructions here..."
          />
        </CardContent>
      </Card>

      <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
        <h4 className="text-sm font-bold text-blue-900 mb-1">Editing Guide</h4>
        <ul className="text-xs text-blue-800/80 list-disc pl-4 space-y-1">
          <li>Ensure you maintain the <strong>SYSTEM ROLE</strong> and <strong>GLOBAL SAFETY PROHIBITIONS</strong>.</li>
          <li>Updates to <strong>TRIGGERS</strong> must match the frontend state machine logic.</li>
          <li>Keep text textbook-style and neutral as per Dr. Attili's clinical persona.</li>
        </ul>
      </div>
    </div>
  );
};
