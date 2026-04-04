import React from 'react';
import { cn } from '@/lib/utils';
import { Menu, X, HeartPulse } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { name: 'HOME', href: 'https://www.onlineskinspecialist.com/' },
    { name: 'CASES', href: 'https://www.onlineskinspecialist.com/cases/' },
    { name: 'DOCTORS', href: 'https://www.onlineskinspecialist.com/consultant-dermatologist/' },
    { name: 'TESTIMONIALS', href: 'https://www.onlineskinspecialist.com/testimonials/' },
    { name: 'BLOG', href: 'https://www.onlineskinspecialist.com/skincareblog/' },
    { name: 'PERSPECTIVES', href: 'https://www.onlineskinspecialist.com/perspectives/' },
    { name: 'CONTACT US', href: 'https://www.onlineskinspecialist.com/contact-us/' },
  ];

  return (
    <header className="bg-white border-b border-gray-100 z-50">
      <div className="container mx-auto px-4 md:px-6 py-4 flex items-center justify-between">

        {/* Logo — stays on current page (React Router) */}
        <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
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
        </Link>

        {/* Desktop Nav — all links open in new tab */}
        <nav className="hidden lg:flex items-center gap-6">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-navy font-bold text-xs tracking-wider hover:text-accent-blue transition-colors"
            >
              {link.name}
            </a>
          ))}
          <a
            href="https://www.onlineskinspecialist.com/cases/ask-a-question/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary-atilli text-[10px] px-4 py-2"
          >
            SUBMIT YOUR CASE +
          </a>
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="lg:hidden text-navy"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Nav — all links open in new tab */}
      {isMenuOpen && (
        <nav className="lg:hidden bg-white border-t border-gray-100 p-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-navy font-bold text-sm tracking-wider hover:text-accent-blue transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              {link.name}
            </a>
          ))}
          <a
            href="https://www.onlineskinspecialist.com/cases/ask-a-question/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary-atilli text-center"
            onClick={() => setIsMenuOpen(false)}
          >
            SUBMIT YOUR CASE +
          </a>
        </nav>
      )}
    </header>
  );
};
