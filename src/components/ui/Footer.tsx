import React from 'react';
import { HeartPulse, Phone, MapPin, Facebook, Instagram, Linkedin, Twitter, MessageSquare, Mail } from 'lucide-react';

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
          <div className="pt-footer-social flex items-center gap-4">
            <a target="_blank" rel="noopener noreferrer" href="https://www.facebook.com/visakhaskinclinic?fref=ts" className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
              <Facebook className="h-4 w-4" />
            </a>
            <a target="_blank" rel="noopener noreferrer" href="https://www.instagram.com/dr_sasi_k_attili/" className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
              <Instagram className="h-4 w-4" />
            </a>
            <a target="_blank" rel="noopener noreferrer" href="https://www.linkedin.com/in/sasiattili/" className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
              <Linkedin className="h-4 w-4" />
            </a>
            <a target="_blank" rel="noopener noreferrer" href="https://x.com/online_skin" className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
              <Twitter className="h-4 w-4" />
            </a>
            <a target="_blank" rel="noopener noreferrer" href="https://wa.me/917799350193" className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
              <MessageSquare className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Center Column: Menu */}
        <div className="space-y-6 text-sm">
          <h3 className="text-lg font-bold border-b border-white/10 pb-2 inline-block w-full uppercase tracking-widest text-xs">Menu</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
            <ul className="space-y-2 text-gray-300">
              <li><a href="https://www.onlineskinspecialist.com/" className="hover:text-accent-blue transition-colors flex items-center gap-2"><span>›</span> Home</a></li>
              <li><a href="https://www.onlineskinspecialist.com/frequently-asked-questions/" className="hover:text-accent-blue transition-colors flex items-center gap-2"><span>›</span> FAQ</a></li>
              <li><a href="https://www.onlineskinspecialist.com/cases/" className="hover:text-accent-blue transition-colors flex items-center gap-2"><span>›</span> Cases</a></li>
              <li><a href="https://www.onlineskinspecialist.com/cases/ask-a-question/" className="hover:text-accent-blue transition-colors flex items-center gap-2"><span>›</span> Submit your Case</a></li>
              <li><a href="https://www.onlineskinspecialist.com/testimonials/" className="hover:text-accent-blue transition-colors flex items-center gap-2"><span>›</span> Testimonials</a></li>
            </ul>
            <ul className="space-y-2 text-gray-300">
              <li><a href="https://www.onlineskinspecialist.com/skinquestions/" className="hover:text-accent-blue transition-colors flex items-center gap-2"><span>›</span> SkinQuestions</a></li>
              <li><a href="https://www.onlineskinspecialist.com/perspectives/" className="hover:text-accent-blue transition-colors flex items-center gap-2"><span>›</span> Perspectives</a></li>
              <li><a href="https://www.onlineskinspecialist.com/skincareblog/" className="hover:text-accent-blue transition-colors flex items-center gap-2"><span>›</span> Blog</a></li>
              <li><a href="https://www.onlineskinspecialist.com/trusted-dermatology-resources/" className="hover:text-accent-blue transition-colors flex items-center gap-2"><span>›</span> Trusted Dermatology Resources</a></li>
              <li><a href="https://www.onlineskinspecialist.com/privacy-policy/" className="hover:text-accent-blue transition-colors flex items-center gap-2"><span>›</span> Privacy Policy</a></li>
            </ul>
          </div>
        </div>

        {/* Right Column: Contact */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold border-b border-white/10 pb-2 inline-block w-full uppercase tracking-widest text-xs">Contact Us</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3 text-sm text-gray-300">
              <Phone className="h-5 w-5 text-accent-blue shrink-0" />
              <a href="tel:+917799350193" className="hover:text-white transition-colors">+91 7799350193</a>
            </div>
            <div className="flex items-start gap-3 text-sm text-gray-300 leading-relaxed">
              <MapPin className="h-5 w-5 text-accent-blue shrink-0" />
              <p>Collector's Office to Beach Approach (down) Road, Opposite Apex Hospital, Maharanipeta, Visakhapatnam. 530002. Andhra Pradesh.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright Bar */}
      <div className="container mx-auto mt-12 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] text-gray-400 uppercase tracking-widest font-bold">
        <p>Copyright © 2024 Online Skin Specialist. All rights reserved.</p>
        <p>Powered by <a href="https://www.letsfettle.com/" target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:text-white transition-colors">Fettle.</a></p>
      </div>

    </footer>
  );
};
