import React from 'react';
import { cn } from '@/lib/utils';
import { Menu, X, HeartPulse } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const navLinks = [
    { name: 'HOME', path: '/' },
    { name: 'CASES', path: '/doctor-login' },
    { name: 'DOCTORS', path: '#' },
    { name: 'TESTIMONIALS', path: '#' },
    { name: 'BLOG', path: '#' },
    { name: 'PERSPECTIVES', path: '#' },
    { name: 'CONTACT US', path: '#' },
  ];

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="container mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
        {/* Logo Section */}
        <div className="flex items-center gap-3">
          <div className="bg-navy p-2 rounded-lg text-white">
            <HeartPulse className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-navy font-bold text-lg leading-tight tracking-tight uppercase">
              Online Skin Specialist
            </span>
            <span className="text-accent-blue text-[10px] font-medium leading-none">
              The next generation in dermatology care
            </span>
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-6">
          {navLinks.map((link) => (
            link.path.startsWith('/') ? (
              <Link
                key={link.name}
                to={link.path}
                className="text-navy font-bold text-xs tracking-wider hover:text-accent-blue transition-colors"
              >
                {link.name}
              </Link>
            ) : (
              <a
                key={link.name}
                href={link.path}
                className="text-navy font-bold text-xs tracking-wider hover:text-accent-blue transition-colors"
              >
                {link.name}
              </a>
            )
          ))}
        </nav>

        {/* Mobile Menu Button */}
        <button 
          className="lg:hidden text-navy"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Nav */}
      {isMenuOpen && (
        <nav className="lg:hidden bg-white border-t border-gray-100 p-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            link.path.startsWith('/') ? (
              <Link
                key={link.name}
                to={link.path}
                className="text-navy font-bold text-sm tracking-wider hover:text-accent-blue transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {link.name}
              </Link>
            ) : (
              <a
                key={link.name}
                href={link.path}
                className="text-navy font-bold text-sm tracking-wider hover:text-accent-blue transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {link.name}
              </a>
            )
          ))}
        </nav>
      )}
    </header>
  );
};
