
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="py-6 px-8 flex justify-between items-center border-b border-white/5 sticky top-0 z-50 glass">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
          <i className="fa-solid fa-wand-magic-sparkles text-white text-xl"></i>
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Lumina<span className="gradient-text">Retouch</span></h1>
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">AI Pro Photo Editor</p>
        </div>
      </div>
      
      <div className="hidden md:flex items-center gap-6">
        <nav className="flex gap-4 text-sm font-medium text-white/60">
          <a href="#" className="hover:text-white transition-colors">Retouch</a>
          <a href="#" className="hover:text-white transition-colors">History</a>
          <a href="#" className="hover:text-white transition-colors">Pricing</a>
        </nav>
        <div className="h-6 w-px bg-white/10"></div>
        <button className="text-white/80 hover:text-white">
          <i className="fa-solid fa-user-circle text-2xl"></i>
        </button>
      </div>
    </header>
  );
};

export default Header;
