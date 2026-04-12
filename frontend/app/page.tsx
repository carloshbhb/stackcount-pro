'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, History, Zap, BarChart3, Settings } from 'lucide-react';

export default function StackCountApp() {
  const [isScanning, setIsScanning] = useState(false);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Inicia a câmera automaticamente ao ativar o scanner
  const startCamera = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => console.error("Erro ao dar play:", e));
        };
      }
    } catch (err) {
      console.error("Erro ao acessar câmera:", err);
      alert("Câmera não disponível. Verifique as permissões de HTTPS e navegador.");
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setIsScanning(false);
  };

  const handleCapture = () => {
    setLoading(true);
    // Simulação de envio para o Backend Railway
    setTimeout(() => {
      setCount(Math.floor(Math.random() * 50) + 1);
      setLoading(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#07070f] text-white font-sans flex flex-col">
      {/* Header */}
      <header className="p-6 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <Zap className="text-white w-5 h-5 fill-current" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">STACKCOUNT<span className="text-orange-500">PRO</span></h1>
        </div>
        <button onClick={() => window.location.reload()} className="p-2 bg-white/5 rounded-full">
          <Settings className="w-5 h-5 text-gray-400" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-6">
        <div className="relative w-full aspect-[3/4] bg-white/5 rounded-3xl overflow-hidden border border-white/10 mb-6">
          {!isScanning ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mb-4">
                <Camera className="w-10 h-10 text-orange-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Pronto para contar?</h2>
              <p className="text-gray-400 mb-8">Aponte para a pilha de objetos e deixe a IA trabalhar.</p>
              <button 
                onClick={startCamera}
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-orange-500/20"
              >
                Ativar Scanner
              </button>
            </div>
          ) : (
            <>
              <video 
                ref={videoRef} 
                playsInline 
                autoPlay 
                muted 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border-[2px] border-orange-500/50 m-12 rounded-xl pointer-events-none">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-500 rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-500 rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-500 rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-500 rounded-br-lg"></div>
              </div>
              <button 
                onClick={stopCamera}
                className="absolute top-4 right-4 bg-black/50 p-2 rounded-full text-white"
              >
                X
              </button>
            </>
          )}
        </div>

        {/* Stats Card */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <p className="text-gray-400 text-sm mb-1">Última Contagem</p>
            <p className="text-3xl font-bold text-orange-500">{loading ? "..." : count}</p>
          </div>
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <p className="text-gray-400 text-sm mb-1">Status IA</p>
            <p className="text-sm font-medium text-green-400 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Online
            </p>
          </div>
        </div>

        {/* Action Button */}
        {isScanning && (
          <button 
            onClick={handleCapture}
            disabled={loading}
            className={`w-full py-5 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 transition-all ${
              loading ? 'bg-gray-700' : 'bg-white text-black hover:bg-gray-200'
            }`}
          >
            {loading ? (
              <div className="w-6 h-6 border-4 border-black/20 border-t-black rounded-full animate-spin"></div>
            ) : (
              <>
                <Zap className="w-6 h-6 fill-current" />
                CONTAR AGORA
              </>
            )}
          </button>
        )}
      </main>

      {/* Tab Bar */}
      <nav className="p-6 bg-black/40 backdrop-blur-lg border-t border-white/5 flex justify-around items-center">
        <button className="flex flex-col items-center gap-1 text-orange-500">
          <Camera className="w-6 h-6" />
          <span className="text-[10px] font-bold">Scanner</span>
        </button>
        <button 
          onClick={() => window.location.href = '#'} 
          className="flex flex-col items-center gap-1 text-gray-500 hover:text-white transition-colors"
        >
          <History className="w-6 h-6" />
          <span className="text-[10px] font-bold">Histórico</span>
        </button>
        <button 
          onClick={() => window.location.href = '#'}
          className="flex flex-col items-center gap-1 text-gray-500 hover:text-white transition-colors"
        >
          <BarChart3 className="w-6 h-6" />
          <span className="text-[10px] font-bold">Relatórios</span>
        </button>
      </nav>
    </div>
  );
}
