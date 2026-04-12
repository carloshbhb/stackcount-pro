'use client';

import React, { useState, useRef } from 'react';
import { Camera, Zap, Settings, CheckCircle2, FileText, X, Loader2 } from 'lucide-react';

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
        video: { facingMode: "environment", width: 1280, height: 720 }
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Erro ao aceder à câmara.");
      setIsScanning(false);
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setLoading(true);

    const context = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context?.drawImage(videoRef.current, 0, 0);

    canvasRef.current.toBlob(async (blob) => {
      if (!blob) return;
      setCapturedBlob(blob);

      // 1. Chamar a IA Real no Backend
      const formData = new FormData();
      formData.append('image', blob, 'capture.jpg');

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/predict`, {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        
        setCount(data.ia_count);
        setRealCount(data.ia_count);
        setShowCalibration(true);
        stopCamera();
      } catch (error) {
        alert("Erro ao processar imagem com Gemini.");
      } finally {
        setLoading(false);
      }
    }, 'image/jpeg', 0.9);
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(t => t.stop());
    setIsScanning(false);
  };

  const saveAndTrain = async () => {
    if (!capturedBlob) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('image', capturedBlob, 'train.jpg');
    formData.append('item_name', itemName);
    formData.append('ia_count', count?.toString() || "0");
    formData.append('real_count', realCount.toString());

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/train`, { method: 'POST', body: formData });
      alert("Sistema treinado com sucesso!");
      setShowCalibration(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070f] text-white flex flex-col font-sans">
      <canvas ref={canvasRef} className="hidden" />
      
      <header className="p-6 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-2">
          <Zap className="text-orange-500 fill-current w-5 h-5" />
          <h1 className="text-lg font-black italic tracking-tighter">STACKCOUNT <span className="text-orange-500">PRO</span></h1>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 bg-white/5 rounded-full">
          {showSettings ? <X /> : <Settings className="text-gray-400" />}
        </button>
      </header>

      <main className="flex-1 p-6 flex flex-col max-w-md mx-auto w-full">
        {showSettings && (
          <div className="mb-6 p-5 bg-white/5 border border-white/10 rounded-3xl animate-in slide-in-from-top">
            <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Publicação Ativa</label>
            <input value={itemName} onChange={e => setItemName(e.target.value)} className="w-full bg-transparent border-b border-white/10 py-2 outline-none font-bold text-xl mb-4" />
          </div>
        )}

        <div className="relative flex-1 bg-white/5 rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center">
          {!isScanning && !showCalibration ? (
            <div className="flex flex-col items-center p-10 text-center">
              <Camera className="text-orange-500 w-16 h-16 mb-8 opacity-20" />
              <button onClick={startCamera} className="bg-orange-500 px-10 py-5 rounded-2xl font-black text-xl shadow-xl shadow-orange-500/20">ABRIR SCANNER</button>
            </div>
          ) : isScanning ? (
            <>
              <video ref={videoRef} playsInline autoPlay muted className="w-full h-full object-cover" />
              <button onClick={handleCapture} disabled={loading} className="absolute bottom-10 left-10 right-10 bg-white text-black py-5 rounded-2xl font-black text-xl">
                {loading ? <Loader2 className="animate-spin mx-auto" /> : "ANALISAR AGORA"}
              </button>
            </>
          ) : showCalibration ? (
            <div className="flex flex-col items-center p-8 animate-in zoom-in">
              <h2 className="text-orange-500 font-black text-5xl mb-12 italic">{realCount}</h2>
              <div className="flex gap-10 mb-12">
                <button onClick={() => setRealCount(Math.max(0, realCount - 1))} className="text-4xl opacity-40">-</button>
                <button onClick={() => setRealCount(realCount + 1)} className="text-4xl opacity-40">+</button>
              </div>
              <button onClick={saveAndTrain} disabled={loading} className="w-full bg-green-500 py-5 rounded-2xl font-black text-xl shadow-lg">
                {loading ? "A TREINAR..." : "CONFIRMAR CONTAGEM"}
              </button>
            </div>
          ) : null}
        </div>
      </main>

      <nav className="p-8 bg-black/60 border-t border-white/5 flex justify-around">
        <Camera className="text-orange-500" />
        <FileText className="text-gray-600" />
      </nav>
    </div>
  );
}
