import React from 'react';
import { HeartPulse, Phone, MapPin, Facebook, Instagram, Linkedin, Twitter, MessageSquare } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-navy text-white py-12 px-4 md:px-6">
      <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
        {/* Left Column: Branding */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-lg text-navy">
              <HeartPulse className="h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-bold text-lg leading-tight tracking-tight uppercase">
                Online Skin Specialist
              </span>
              <span className="text-accent-blue text-[10px] font-medium leading-none italic">
                The next generation in dermatology care
              </span>
            </div>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed max-w-xs">
            World Class Dermatology Services in Our Friendly Skin Clinic. Providing expert educational skin health insights from UK Consultant Dermatologists.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
              <Facebook className="h-4 w-4" />
            </a>
            <a href="#" className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
              <Instagram className="h-4 w-4" />
            </a>
            <a href="#" className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
              <Linkedin className="h-4 w-4" />
            </a>
            <a href="#" className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
              <Twitter className="h-4 w-4" />
            </a>
            <a href="#" className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
              <MessageSquare className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Center Column: Menu */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold border-b border-white/10 pb-2 inline-block w-full">Menu</h3>
          <div className="grid grid-cols-2 gap-4">
            <ul className="space-y-2 text-sm text-gray-300">
              <li><a href="#" className="hover:text-accent-blue transition-colors flex items-center gap-2"><span>›</span> Home</a></li>
              <li><a href="#" className="hover:text-accent-blue transition-colors flex items-center gap-2"><span>›</span> Cases</a></li>
              <li><a href="#" className="hover:text-accent-blue transition-colors flex items-center gap-2"><span>›</span> Testimonials</a></li>
              <li><a href="#" className="hover:text-accent-blue transition-colors flex items-center gap-2"><span>›</span> Perspectives</a></li>
            </ul>
            <ul className="space-y-2 text-sm text-gray-300">
              <li><a href="#" className="hover:text-accent-blue transition-colors flex items-center gap-2"><span>›</span> FAQ</a></li>
              <li><a href="#" className="hover:text-accent-blue transition-colors flex items-center gap-2"><span>›</span> Submit Your Case</a></li>
              <li><a href="#" className="hover:text-accent-blue transition-colors flex items-center gap-2"><span>›</span> SkinQuestions</a></li>
              <li><a href="#" className="hover:text-accent-blue transition-colors flex items-center gap-2"><span>›</span> Blog</a></li>
            </ul>
          </div>
        </div>

        {/* Right Column: Contact */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold border-b border-white/10 pb-2 inline-block w-full">Contact Us</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3 text-sm text-gray-300">
              <Phone className="h-5 w-5 text-accent-blue shrink-0" />
              <a href="tel:+917799350193" className="hover:text-white transition-colors">+91 7799350193</a>
            </div>
            <div className="flex items-start gap-3 text-sm text-gray-300">
              <MapPin className="h-5 w-5 text-accent-blue shrink-0" />
              <p>Collector's Office to Beach Approach (down) Road, Opposite Apex Hospital, Maharani peta, Visakhapatnam. 530002. Andhra Pradesh.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright Bar */}
      <div className="container mx-auto mt-12 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] text-gray-400 uppercase tracking-widest font-bold">
        <p>Copyright © 2024 Online Skin Specialist. All rights reserved.</p>
        <p>Powered by <a href="#" className="text-accent-blue hover:text-white transition-colors">Sanchan Info Solutions.</a></p>
      </div>
    </footer>
  );
};
