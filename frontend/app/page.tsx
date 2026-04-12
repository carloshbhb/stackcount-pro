'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Package, History, Settings, Zap, RefreshCw, ChevronRight } from 'lucide-react';

/**
 * StackCount PRO - Frontend Principal
 * Desenvolvido com foco em UX Minimalista e Alta Performance.
 */
export default function StackCountPage() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<null | { count: number; confidence: number }>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Inicia a câmera automaticamente ao carregar (se permitido)
  const startCamera = async () => {
    try {
      const media = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 } } 
      });
      setStream(media);
      if (videoRef.current) videoRef.current.srcObject = media;
    } catch (err) {
      console.error("Erro ao acessar a câmera:", err);
    }
  };

  // Simulação de análise (Conecta com a Etapa 2 - Backend)
  const handleCapture = async () => {
    setIsAnalyzing(true);
    setResult(null);

    // Endpoint do Backend na Railway
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    try {
      // Simulação de delay da IA (2.5s)
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Aqui seria a chamada real:
      // const formData = new FormData();
      // formData.append('file', blob);
      // const res = await fetch(`${API_URL}/analyze`, { method: 'POST', body: formData });
      
      setResult({ count: 42, confidence: 0.98 });
    } catch (error) {
      console.error("Erro na análise:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070f] text-slate-200 font-sans selection:bg-purple-500/30">
      
      {/* Header Estilo Glassmorphism */}
      <header className="p-6 flex justify-between items-center border-b border-white/5 sticky top-0 bg-[#07070f]/80 backdrop-blur-md z-50">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            STACK<span className="text-purple-500">COUNT</span>
            <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/30">PRO</span>
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium italic">IA Vision Online</p>
          </div>
        </div>
        <button className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
          <Settings size={20} className="text-slate-400" />
        </button>
      </header>

      <main className="max-w-md mx-auto p-6 pb-32">
        
        {/* Card de Visualização da Câmera */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative aspect-[3/4] bg-slate-900 rounded-[2.5rem] border-2 border-white/5 overflow-hidden shadow-2xl shadow-purple-500/5"
        >
          {!stream ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-slate-900 to-black">
              <div className="w-20 h-20 bg-purple-500/10 rounded-3xl flex items-center justify-center mb-6 border border-purple-500/20">
                <Camera size={32} className="text-purple-500" />
              </div>
              <h2 className="text-white font-semibold mb-2">Pronto para contar?</h2>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">Ative a câmera para que a nossa IA identifique as publicações automaticamente.</p>
              <button 
                onClick={startCamera}
                className="px-8 py-3 bg-white text-black rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-lg"
              >
                Ativar Scanner
              </button>
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              
              {/* Overlay de Scan */}
              <AnimatePresence>
                {isAnalyzing && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center"
                  >
                    <div className="flex flex-col items-center">
                      <div className="relative w-16 h-16">
                        <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full" />
                        <div className="absolute inset-0 border-4 border-t-purple-500 rounded-full animate-spin" />
                      </div>
                      <p className="mt-4 text-xs font-mono tracking-[0.2em] text-purple-300 animate-pulse">PROCESSANDO PIXEL DATA...</p>
                    </div>
                    {/* Linha de Scanner Animada */}
                    <motion.div 
                      animate={{ top: ['0%', '100%', '0%'] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </motion.div>

        {/* Resultados e Widgets */}
        <div className="mt-8 grid grid-cols-2 gap-4">
          <motion.div 
            whileTap={{ scale: 0.98 }}
            className="bg-white/5 border border-white/5 p-5 rounded-[2rem] flex flex-col items-center justify-center gap-2"
          >
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Contagem</span>
            <span className="text-3xl font-bold text-white">{result ? result.count : '--'}</span>
          </motion.div>
          
          <motion.div 
            whileTap={{ scale: 0.98 }}
            className="bg-white/5 border border-white/5 p-5 rounded-[2rem] flex flex-col items-center justify-center gap-2"
          >
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Confiança</span>
            <span className="text-3xl font-bold text-purple-500">{result ? `${(result.confidence * 100).toFixed(0)}%` : '--'}</span>
          </motion.div>
        </div>

      </main>

      {/* Barra de Navegação Flutuante Inferior */}
      <footer className="fixed bottom-8 left-6 right-6 z-50">
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/10 h-20 rounded-[2.5rem] flex items-center justify-around px-6 shadow-2xl">
          <NavIcon icon={<History size={22} />} label="Histórico" />
          
          {/* Botão de Disparo Principal */}
          <button 
            disabled={!stream || isAnalyzing}
            onClick={handleCapture}
            className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center -translate-y-8 shadow-[0_20px_40px_rgba(0,0,0,0.4)] active:scale-90 transition-all disabled:opacity-30 disabled:grayscale"
          >
            <div className="w-16 h-16 border-2 border-slate-900 rounded-2xl flex items-center justify-center">
              <Zap size={28} className="text-slate-900 fill-slate-900" />
            </div>
          </button>

          <NavIcon icon={<Package size={22} />} label="Estoque" />
        </div>
      </footer>
    </div>
  );
}

function NavIcon({ icon, label, active = false }: any) {
  return (
    <button className={`flex flex-col items-center gap-1.5 transition-colors ${active ? 'text-purple-500' : 'text-slate-500 hover:text-slate-300'}`}>
      {icon}
      <span className="text-[9px] font-bold uppercase tracking-tighter">{label}</span>
    </button>
  );
}
