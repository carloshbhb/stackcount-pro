'use client';

import React, { useState, useRef } from 'react';
import { Camera, History, Zap, BarChart3, Settings, CheckCircle2, PlusCircle, FileText, Trash2, X } from 'lucide-react';

export default function StackCountApp() {
  const [isScanning, setIsScanning] = useState(false);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [realCount, setRealCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    setIsScanning(true);
    setShowCalibration(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play();
      }
    } catch (err) {
      alert("Erro ao acessar câmera. Verifique as permissões HTTPS.");
      setIsScanning(false);
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setLoading(true);

    const context = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context?.drawImage(videoRef.current, 0, 0);

    canvasRef.current.toBlob((blob) => {
      setCapturedBlob(blob);
      // Simulação da IA - Aqui você integraria a chamada da API de Visão
      const iaResult = Math.floor(Math.random() * 20) + 1;
      setCount(iaResult);
      setRealCount(iaResult);
      setLoading(false);
      setShowCalibration(true);
      stopCamera();
    }, 'image/jpeg', 0.8);
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setIsScanning(false);
  };

  const saveAndTrain = async () => {
    if (!capturedBlob) return;
    setLoading(true);

    const formData = new FormData();
    formData.append('image', capturedBlob, 'feedback.jpg');
    formData.append('ia_count', count?.toString() || "0");
    formData.append('real_count', realCount.toString());
    formData.append('item_name', "Publicação Padrão");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/train`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        alert("IA Treinada! Dados salvos no inventário.");
        setShowCalibration(false);
        setCount(null);
      }
    } catch (error) {
      alert("Erro ao conectar com o Backend na Railway.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070f] text-white flex flex-col font-sans">
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Header */}
      <header className="p-6 flex justify-between items-center border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/40">
            <Zap className="text-white w-5 h-5 fill-current" />
          </div>
          <h1 className="text-xl font-black italic tracking-tighter">STACKCOUNT PRO</h1>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 bg-white/5 rounded-full">
          {showSettings ? <X className="w-6 h-6 text-orange-500" /> : <Settings className="w-6 h-6 text-gray-400" />}
        </button>
      </header>

      <main className="flex-1 p-6 flex flex-col max-w-md mx-auto w-full">
        {showSettings && (
          <div className="mb-6 p-5 bg-orange-500/10 border border-orange-500/20 rounded-3xl space-y-4 animate-in slide-in-from-top">
            <h2 className="text-xs font-black text-orange-500 tracking-widest uppercase">Gestão de Inventário</h2>
            <button className="w-full flex items-center gap-3 p-4 bg-white/5 rounded-2xl text-left border border-white/5"><PlusCircle className="text-green-400" /> Cadastrar Novo Item</button>
            <button className="w-full flex items-center gap-3 p-4 bg-white/5 rounded-2xl text-left border border-white/5"><FileText className="text-blue-400" /> Exportar Relatório Mensal</button>
            <button className="w-full flex items-center gap-3 p-4 bg-white/5 rounded-2xl text-left border border-white/5 text-red-400"><Trash2 className="w-5 h-5" /> Resetar Banco de Dados</button>
          </div>
        )}

        <div className="relative flex-1 bg-gradient-to-b from-white/5 to-transparent rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl min-h-[400px]">
          {!isScanning && !showCalibration ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center">
              <div className="w-24 h-24 bg-orange-500/10 rounded-full flex items-center justify-center mb-8 border border-orange-500/20">
                <Camera className="w-10 h-10 text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold mb-3 uppercase tracking-tighter">Scanner IA</h3>
              <p className="text-gray-500 text-sm mb-10 leading-relaxed">Posicione a câmera lateralmente à pilha para uma contagem precisa.</p>
              <button onClick={startCamera} className="w-full bg-orange-500 hover:bg-orange-600 py-5 rounded-2xl font-black text-lg shadow-xl shadow-orange-500/20 active:scale-95 transition-all">
                ABRIR CÂMERA
              </button>
            </div>
          ) : isScanning ? (
            <>
              <video ref={videoRef} playsInline autoPlay muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 border-[3px] border-orange-500/30 m-12 rounded-3xl pointer-events-none shadow-[0_0_50px_rgba(249,115,22,0.2)]" />
              <div className="absolute bottom-8 left-8 right-8 space-y-4">
                <button onClick={handleCapture} disabled={loading} className="w-full bg-white text-black py-5 rounded-2xl font-black text-xl shadow-2xl active:scale-95 transition-all">
                  {loading ? "ANALISANDO..." : "CAPTURAR E CONTAR"}
                </button>
                <button onClick={stopCamera} className="w-full text-gray-400 font-bold text-xs uppercase tracking-widest">Cancelar</button>
              </div>
            </>
          ) : showCalibration ? (
            <div className="absolute inset-0 bg-[#07070f] flex flex-col items-center justify-center p-8 animate-in zoom-in">
              <div className="mb-8 text-center">
                <p className="text-xs font-black text-orange-500 tracking-[0.3em] uppercase mb-2">Resultado IA</p>
                <h2 className="text-5xl font-black tracking-tighter italic italic">SUGESTÃO: {count}</h2>
              </div>
              
              <div className="bg-white/5 p-8 rounded-[3rem] border border-white/10 flex items-center gap-8 mb-12 shadow-inner">
                <button onClick={() => setRealCount(Math.max(0, realCount - 1))} className="w-14 h-14 bg-white/5 rounded-full text-3xl font-light hover:bg-orange-500 transition-colors">-</button>
                <span className="text-7xl font-black min-w-[120px] text-center">{realCount}</span>
                <button onClick={() => setRealCount(realCount + 1)} className="w-14 h-14 bg-white/5 rounded-full text-3xl font-light hover:bg-orange-500 transition-colors">+</button>
              </div>

              <div className="w-full space-y-4">
                <button onClick={saveAndTrain} disabled={loading} className="w-full bg-green-500 py-5 rounded-2xl font-black text-xl shadow-lg shadow-green-500/20 flex items-center justify-center gap-3">
                  <CheckCircle2 /> {loading ? "SALVANDO..." : "CONFIRMAR TREINO"}
                </button>
                <button onClick={() => setShowCalibration(false)} className="w-full py-4 text-gray-500 font-bold uppercase tracking-widest text-xs">Descartar</button>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      {/* Footer Navigation */}
      <nav className="p-8 bg-black/60 backdrop-blur-2xl border-t border-white/5 flex justify-around items-center">
        <button className="flex flex-col items-center gap-1.5 text-orange-500 scale-110"><Camera className="w-6 h-6" /><span className="text-[10px] font-black uppercase tracking-tighter">Scanner</span></button>
        <button className="flex flex-col items-center gap-1.5 text-gray-600"><History className="w-6 h-6" /><span className="text-[10px] font-black uppercase tracking-tighter">Estoque</span></button>
        <button className="flex flex-col items-center gap-1.5 text-gray-600"><BarChart3 className="w-6 h-6" /><span className="text-[10px] font-black uppercase tracking-tighter">Relatório</span></button>
      </nav>
    </div>
  );
}
