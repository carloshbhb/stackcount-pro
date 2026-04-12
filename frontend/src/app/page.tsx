// frontend/src/app/page.tsx
'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Package, History, Settings } from 'lucide-react';

export default function StackCountApp() {
  const [view, setView] = useState('camera');

  return (
    <div className="min-h-screen bg-[#07070f] text-slate-200 font-sans p-6">
      {/* Header Minimalista */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">StackCount <span className="text-purple-500">PRO</span></h1>
          <p className="text-xs text-slate-500 uppercase tracking-widest">AI Vision Engine</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center">
          <Settings size={18} className="text-slate-400" />
        </div>
      </header>

      {/* Área Principal (Câmera Simulada) */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full aspect-[3/4] bg-slate-900 rounded-[2.5rem] border-2 border-white/5 overflow-hidden shadow-2xl mb-8"
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
          <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mb-4">
            <Camera size={40} className="text-purple-500" />
          </div>
          <p className="text-slate-400 text-sm">Aponte para a pilha de publicações para iniciar a contagem por IA</p>
        </div>
        
        {/* Scanning Line Animation */}
        <motion.div 
          animate={{ top: ['0%', '100%', '0%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"
        />
      </motion.div>

      {/* Bottom Navigation (Aconchegante) */}
      <nav className="fixed bottom-8 left-6 right-6 h-20 bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-white/10 flex justify-around items-center px-4">
        <NavButton active={view === 'history'} onClick={() => setView('history')} icon={<History size={22} />} label="Histórico" />
        <button className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center -translate-y-8 shadow-xl shadow-purple-500/20 active:scale-95 transition-transform">
          <div className="w-12 h-12 border-2 border-slate-900 rounded-xl flex items-center justify-center">
             <div className="w-2 h-2 bg-slate-900 rounded-full animate-ping" />
          </div>
        </button>
        <NavButton active={view === 'inventory'} onClick={() => setView('inventory')} icon={<Package size={22} />} label="Estoque" />
      </nav>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? 'text-white' : 'text-slate-500'}`}>
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-tighter">{label}</span>
    </button>
  );
}
