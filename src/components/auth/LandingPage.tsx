import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { HeartPulse, CheckCircle, Clock, Save, UserCheck, ChevronRight, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const LandingPage: React.FC = () => {
  const { testLoginAsPatient } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="py-20 px-4 text-center bg-white border-b border-gray-50">
        <div className="container mx-auto max-w-4xl space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold text-navy tracking-tight leading-tight">
            Affordable Expert Skin Insights
          </h1>
          <p className="text-gray-600 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
            Receive educational skin health insights from a UK Consultant Dermatologist — similar to a private consultation, but at a fraction of the typical cost. Starting from just $49.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button onClick={testLoginAsPatient} className="btn-primary-atilli text-lg h-14 px-8 shadow-xl shadow-navy/20">
              SUBMIT YOUR CASE +
            </Button>
            <Button variant="ghost" className="text-accent-blue font-bold hover:text-navy" onClick={() => navigate('/doctor-login')}>
              DOCTOR PORTAL
            </Button>
          </div>
          <div className="inline-block bg-[#fdf5e6] px-6 py-3 rounded-lg border border-[#f5deb3]/50">
            <p className="text-xs text-gray-700 italic">
              <span className="font-bold uppercase not-italic mr-2">Service Disclaimer:</span>
              This is an advisory-only dermatology service. No prescriptions are issued.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-50/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-navy text-center mb-16 uppercase tracking-wider">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: '01', title: 'Create Account', desc: 'Register with email for secure access.', icon: <HeartPulse className="h-6 w-6" /> },
              { step: '02', title: 'Submit Case', desc: 'Describe symptoms & upload photos.', icon: <HeartPulse className="h-6 w-6" /> },
              { step: '03', title: 'Confirm', desc: 'Review & confirm clinical consent.', icon: <HeartPulse className="h-6 w-6" /> },
              { step: '04', title: 'Receive Insights', desc: 'Get expert educational assessment.', icon: <HeartPulse className="h-6 w-6" /> },
            ].map((item, idx) => (
              <div key={idx} className="relative text-center group">
                <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md text-navy font-bold relative z-10 border-2 border-gray-100 group-hover:border-accent-blue transition-colors">
                  {item.step}
                </div>
                {idx < 3 && <div className="hidden md:block absolute top-8 left-1/2 w-full h-0.5 bg-gray-200 -z-0"></div>}
                <h3 className="font-bold text-navy mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed px-4">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dermatologist Intro */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="bg-gray-50/50 rounded-[40px] p-8 md:p-12 flex flex-col md:flex-row items-center gap-12 border border-gray-100">
            <div className="w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-8 border-white shadow-2xl shrink-0">
              <img src="/placeholder.svg" alt="Dr. Sasi Kiran Attili" className="w-full h-full object-cover" />
            </div>
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-navy leading-tight">Meet Your Dermatologist</h2>
              <p className="text-gray-600 leading-relaxed">
                Dr. Sasi Kiran Attili, UK Consultant Dermatologist (GMC 6036602), brings over 20 years of experience in treating skin conditions like acne, eczema, and alopecia. Trust our advisory-only teledermatology service for expert care worldwide.
              </p>
              <div className="flex flex-wrap gap-4 items-center pt-2">
                <img src="/placeholder.svg" alt="General Medical Council" className="h-8 grayscale opacity-50" />
                <img src="/placeholder.svg" alt="Bad" className="h-8 grayscale opacity-50" />
                <img src="/placeholder.svg" alt="DermNet" className="h-8 grayscale opacity-50" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-navy text-center mb-16 uppercase tracking-wider">Key Benefits of Our Service</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {[
              { title: 'No Referral Needed', desc: 'Ask a skin doctor directly, without the need for a referral from your family doctor.', icon: <UserCheck className="text-navy h-8 w-8" /> },
              { title: 'Quick Response', desc: 'We ensure users receive quick answers without delay, typically within 24–48 hours.', icon: <Clock className="text-navy h-8 w-8" /> },
              { title: 'Save Money & Time', desc: 'Consult a dermatologist online for a fraction of the price of an in-person consultation.', icon: <Save className="text-navy h-8 w-8" /> },
              { title: '100% Satisfaction', desc: 'Guaranteed expertise and care. Check out our 100% positive clinical feedback.', icon: <Star className="text-navy h-8 w-8" /> },
            ].map((item, idx) => (
              <Card key={idx} className="border-none shadow-lg shadow-navy/5 overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                <CardContent className="p-8 flex items-start gap-6">
                  <div className="bg-white p-4 rounded-xl shadow-md group-hover:bg-navy group-hover:text-white transition-colors duration-300">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-navy mb-2">{item.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Feedback Section */}
      <section className="py-20 bg-white overflow-hidden">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-navy mb-16 uppercase tracking-wider">Client Feedback</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
            {[
              { name: 'Piotr', text: 'Excellent advice and value for money! Superb.' },
              { name: 'Sarah', text: "Dr. Attili's advice was spot on and easy to follow." },
              { name: 'James', text: 'Fast response and very professional service.' },
            ].map((f, i) => (
              <div key={i} className="bg-gray-50 p-8 rounded-2xl relative">
                <div className="flex justify-center gap-1 mb-4 text-accent-blue">
                  {[...Array(5)].map((_, j) => <Star key={j} className="h-4 w-4 fill-current" />)}
                </div>
                <p className="text-gray-600 italic mb-6">"{f.text}"</p>
                <p className="font-bold text-navy">— {f.name}</p>
                <div className="absolute -top-4 -right-4 opacity-5 text-navy italic text-8xl font-serif">"</div>
              </div>
            ))}
          </div>
          <Button className="btn-primary-atilli bg-navy hover:bg-navy/90 h-12 px-8 uppercase tracking-widest text-xs">
            VIEW ALL +
          </Button>
        </div>
      </section>
    </div>
  );
};
