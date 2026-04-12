'use client';

import React, { useState, useRef } from 'react';
import { Camera, History, Zap, BarChart3, Settings, CheckCircle2, PlusCircle, FileText, X } from 'lucide-react';

export default function StackCountApp() {
  const [isScanning, setIsScanning] = useState(false);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [realCount, setRealCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [itemName, setItemName] = useState("Publicação Padrão");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 1280, height: 720 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play();
      }
    } catch (err) {
      alert("Câmera bloqueada ou sem HTTPS.");
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
      const mockIA = Math.floor(Math.random() * 15) + 1; // Simulação inicial
      setCount(mockIA);
      setRealCount(mockIA);
      setLoading(false);
      setShowCalibration(true);
      stopCamera();
    }, 'image/jpeg', 0.9);
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
    formData.append('image', capturedBlob, 'train.jpg');
    formData.append('item_name', itemName);
    formData.append('ia_count', count?.toString() || "0");
    formData.append('real_count', realCount.toString());

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/train`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        alert("Dados salvos! IA em treinamento.");
        setShowCalibration(false);
      }
    } catch (e) {
      alert("Erro ao enviar para Railway.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070f] text-white flex flex-col font-sans">
      <canvas ref={canvasRef} className="hidden" />
      
      <header className="p-6 flex justify-between items-center border-b border-white/10 sticky top-0 bg-[#07070f]/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          <Zap className="text-orange-500 fill-current w-6 h-6" />
          <h1 className="text-xl font-black italic tracking-tighter">STACKCOUNT PRO</h1>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 bg-white/5 rounded-full">
          {showSettings ? <X /> : <Settings className="text-gray-400" />}
        </button>
      </header>

      <main className="flex-1 p-6 flex flex-col max-w-md mx-auto w-full">
        {showSettings && (
          <div className="mb-6 space-y-3 animate-in slide-in-from-top">
            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
              <label className="text-[10px] font-black text-orange-500 uppercase">Item Atual</label>
              <input 
                value={itemName} 
                onChange={(e) => setItemName(e.target.value)}
                className="w-full bg-transparent border-b border-white/20 py-2 outline-none font-bold"
              />
            </div>
            <button className="w-full flex items-center gap-3 p-4 bg-white/5 rounded-2xl text-xs font-bold uppercase tracking-widest"><FileText className="text-blue-400" /> Relatório Mensal</button>
          </div>
        )}

        <div className="relative flex-1 bg-white/5 rounded-[2.5rem] overflow-hidden border border-white/10">
          {!isScanning && !showCalibration ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-10">
              <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mb-6">
                <Camera className="text-orange-500 w-10 h-10" />
              </div>
              <button onClick={startCamera} className="w-full bg-orange-500 py-5 rounded-2xl font-black text-xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all">
                ABRIR SCANNER
              </button>
            </div>
          ) : isScanning ? (
            <>
              <video ref={videoRef} playsInline autoPlay muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 border-2 border-orange-500/30 m-12 rounded-3xl pointer-events-none" />
              <button onClick={handleCapture} className="absolute bottom-10 left-10 right-10 bg-white text-black py-5 rounded-2xl font-black text-xl active:scale-95 transition-all">
                CONTAR {itemName.toUpperCase()}
              </button>
            </>
          ) : showCalibration ? (
            <div className="absolute inset-0 bg-black flex flex-col items-center justify-center p-8 animate-in zoom-in">
              <h2 className="text-gray-500 font-bold mb-2 uppercase tracking-widest">IA Sugeriu: {count}</h2>
              <div className="flex items-center gap-8 mb-12">
                <button onClick={() => setRealCount(Math.max(0, realCount - 1))} className="text-5xl font-light">-</button>
                <span className="text-8xl font-black text-orange-500">{realCount}</span>
                <button onClick={() => setRealCount(realCount + 1)} className="text-5xl font-light">+</button>
              </div>
              <button onClick={saveFeedback} disabled={loading} className="w-full bg-green-500 py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-3">
                <CheckCircle2 /> {loading ? "SALVANDO..." : "CONFIRMAR E TREINAR"}
              </button>
            </div>
          ) : null}
        </div>
      </main>

      <nav className="p-8 bg-black/40 backdrop-blur-md border-t border-white/5 flex justify-around">
        <button className="flex flex-col items-center text-orange-500"><Camera /><span className="text-[10px] font-bold mt-1">SCAN</span></button>
        <button className="flex flex-col items-center text-gray-600"><History /><span className="text-[10px] font-bold mt-1">ESTOQUE</span></button>
        <button className="flex flex-col items-center text-gray-600"><BarChart3 /><span className="text-[10px] font-bold mt-1">RELATÓRIO</span></button>
      </nav>
    </div>
  );
}
