'use client';

import React, { useState, useRef } from 'react';
import { Camera, Zap, Settings, CheckCircle2, FileText, X, ChevronRight } from 'lucide-react';

export default function StackCountApp() {
  const [isScanning, setIsScanning] = useState(false);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [realCount, setRealCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [itemName, setItemName] = useState("Revista Padrão");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play();
      }
    } catch (err) {
      alert("Acesso à câmera negado.");
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
      // Aqui simulamos a IA. No futuro, esse valor virá da análise 3D.
      const simulatedIA = Math.floor(Math.random() * 10) + 1;
      setCount(simulatedIA);
      setRealCount(simulatedIA);
      setLoading(false);
      setShowCalibration(true);
      stopCamera();
    }, 'image/jpeg', 0.95);
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setIsScanning(false);
  };

  const saveFeedback = async () => {
    if (!capturedBlob) return;
    setLoading(true);

    const formData = new FormData();
    formData.append('image', capturedBlob, 'capture.jpg');
    formData.append('item_name', itemName);
    formData.append('ia_count', count?.toString() || "0");
    formData.append('real_count', realCount.toString());

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/train`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        alert("Calibragem salva com sucesso!");
        setShowCalibration(false);
      }
    } catch (e) {
      alert("Erro ao salvar no servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070f] text-white flex flex-col font-sans overflow-hidden">
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Header Estilizado */}
      <header className="p-6 flex justify-between items-center bg-black/40 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <span className="font-black italic tracking-tighter text-lg">STACKCOUNT <span className="text-orange-500 italic">PRO</span></span>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 bg-white/5 rounded-full border border-white/10">
          {showSettings ? <X className="w-5 h-5" /> : <Settings className="w-5 h-5 text-gray-400" />}
        </button>
      </header>

      <main className="flex-1 p-6 flex flex-col max-w-lg mx-auto w-full">
        {showSettings && (
          <div className="mb-6 p-5 bg-white/5 border border-white/10 rounded-[2rem] space-y-4 animate-in fade-in slide-in-from-top-4">
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 block">Item em Foco</label>
              <input 
                value={itemName} 
                onChange={(e) => setItemName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <button className="w-full flex items-center justify-between p-4 bg-orange-500/10 rounded-xl text-xs font-bold text-orange-500">
              VER RELATÓRIO MENSAL <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Camera/Result Container */}
        <div className="relative flex-1 bg-white/5 rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl">
          {!isScanning && !showCalibration ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-24 h-24 bg-orange-500/10 rounded-full flex items-center justify-center mb-8 border border-orange-500/20">
                <Camera className="w-10 h-10 text-orange-500" />
              </div>
              <h2 className="text-3xl font-black mb-4 tracking-tight">PRONTO?</h2>
              <p className="text-gray-500 text-sm mb-10">IA treinada para contagem volumétrica lateral.</p>
              <button onClick={startCamera} className="w-full bg-orange-500 py-5 rounded-2xl font-black text-xl shadow-xl shadow-orange-500/30 active:scale-95 transition-all">
                ABRIR SCANNER
              </button>
            </div>
          ) : isScanning ? (
            <>
              <video ref={videoRef} playsInline autoPlay muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 border-[4px] border-orange-500/20 m-10 rounded-[2rem] pointer-events-none" />
              <div className="absolute bottom-10 left-10 right-10">
                <button onClick={handleCapture} className="w-full bg-white text-black py-5 rounded-2xl font-black text-xl shadow-2xl">
                  {loading ? "PROCESSANDO..." : "CAPTURAR AGORA"}
                </button>
              </div>
            </>
          ) : showCalibration ? (
            <div className="absolute inset-0 bg-[#07070f] flex flex-col items-center justify-center p-10">
              <span className="text-orange-500 font-black text-[10px] tracking-[0.4em] uppercase mb-4">Validando IA</span>
              <h2 className="text-gray-500 font-bold mb-8">IA SUGERIU: {count}</h2>
              
              <div className="flex items-center gap-10 mb-16">
                <button onClick={() => setRealCount(Math.max(0, realCount - 1))} className="text-6xl font-light text-gray-600">-</button>
                <span className="text-9xl font-black text-white">{realCount}</span>
                <button onClick={() => setRealCount(realCount + 1)} className="text-6xl font-light text-gray-600">+</button>
              </div>

              <button onClick={saveFeedback} disabled={loading} className="w-full bg-green-500 py-6 rounded-3xl font-black text-xl shadow-lg shadow-green-500/20 flex items-center justify-center gap-4 transition-all active:scale-95">
                <CheckCircle2 /> {loading ? "SALVANDO..." : "CONFIRMAR E TREINAR"}
              </button>
              <button onClick={() => setShowCalibration(false)} className="mt-6 text-gray-600 font-bold text-xs uppercase tracking-widest">Descartar</button>
            </div>
          ) : null}
        </div>
      </main>

      {/* Nav Bar Estilizada */}
      <footer className="p-8 bg-black/60 backdrop-blur-2xl border-t border-white/5 flex justify-around items-center">
        <button className="flex flex-col items-center gap-2 text-orange-500">
          <Camera className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">Scan</span>
        </button>
        <button className="flex flex-col items-center gap-2 text-gray-600">
          <FileText className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">Estoque</span>
        </button>
      </footer>
    </div>
  );
}
