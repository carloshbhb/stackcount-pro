'use client';

import React, { useState, useRef } from 'react';
import { Camera, Zap, Settings, CheckCircle2, FileText, X, PlusCircle } from 'lucide-react';

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
      alert("Câmera bloqueada. Use HTTPS.");
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
      // Aqui a IA faria a predição. Simulamos um valor inicial.
      const iaGuess = Math.floor(Math.random() * 10) + 5;
      setCount(iaGuess);
      setRealCount(iaGuess);
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
      alert("Calibragem registrada no Banco de Dados!");
      setShowCalibration(false);
    } catch (e) {
      alert("Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070f] text-white flex flex-col font-sans">
      <canvas ref={canvasRef} className="hidden" />
      <header className="p-6 flex justify-between items-center bg-black/40 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2">
          <Zap className="text-orange-500 fill-current w-5 h-5" />
          <h1 className="text-lg font-black italic tracking-tighter uppercase leading-none">StackCount <span className="text-orange-500">Pro</span></h1>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 bg-white/5 rounded-full">
          {showSettings ? <X /> : <Settings className="text-gray-400" />}
        </button>
      </header>

      <main className="flex-1 p-6 flex flex-col max-w-md mx-auto w-full">
        {showSettings && (
          <div className="mb-6 p-5 bg-orange-500/10 border border-orange-500/20 rounded-3xl animate-in slide-in-from-top">
            <label className="text-[10px] font-black text-orange-500 uppercase tracking-widest block mb-2">Item Monitorado</label>
            <input 
              value={itemName} 
              onChange={(e) => setItemName(e.target.value)}
              className="w-full bg-transparent border-b border-white/10 py-2 outline-none font-bold text-xl mb-4"
            />
            <button className="w-full flex items-center justify-between p-4 bg-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest">
              Relatório de Precisão <FileText className="w-4 h-4 text-blue-400" />
            </button>
          </div>
        )}

        <div className="relative flex-1 bg-white/5 rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl min-h-[400px]">
          {!isScanning && !showCalibration ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center">
              <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mb-8 border border-orange-500/20">
                <Camera className="text-orange-500 w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black mb-4 italic tracking-tight uppercase">Pronto para treinar?</h2>
              <button onClick={startCamera} className="w-full bg-orange-500 py-5 rounded-2xl font-black text-xl shadow-xl shadow-orange-500/20 active:scale-95 transition-all">
                ABRIR SCANNER
              </button>
            </div>
          ) : isScanning ? (
            <>
              <video ref={videoRef} playsInline autoPlay muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 border-2 border-orange-500/20 m-12 rounded-3xl pointer-events-none" />
              <button onClick={handleCapture} className="absolute bottom-10 left-10 right-10 bg-white text-black py-5 rounded-2xl font-black text-xl active:scale-95 transition-all shadow-2xl">
                CAPTURAR {itemName.toUpperCase()}
              </button>
            </>
          ) : showCalibration ? (
            <div className="absolute inset-0 bg-[#07070f] flex flex-col items-center justify-center p-8 animate-in zoom-in">
              <h3 className="text-gray-500 font-bold uppercase tracking-[0.3em] text-[10px] mb-2">IA Sugeriu: {count}</h3>
              <div className="flex items-center gap-8 mb-12">
                <button onClick={() => setRealCount(Math.max(0, realCount - 1))} className="text-5xl font-light text-gray-500">-</button>
                <span className="text-8xl font-black text-orange-500">{realCount}</span>
                <button onClick={() => setRealCount(realCount + 1)} className="text-5xl font-light text-gray-500">+</button>
              </div>
              <button onClick={saveAndTrain} disabled={loading} className="w-full bg-green-500 py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-3 shadow-lg shadow-green-500/20">
                <CheckCircle2 /> {loading ? "SALVANDO..." : "CONFIRMAR E TREINAR"}
              </button>
              <button onClick={() => setShowCalibration(false)} className="mt-8 text-gray-600 font-bold text-xs uppercase tracking-widest">Descartar</button>
            </div>
          ) : null}
        </div>
      </main>

      <nav className="p-8 bg-black/60 backdrop-blur-2xl border-t border-white/5 flex justify-around">
        <button className="flex flex-col items-center text-orange-500"><Camera className="w-6 h-6" /><span className="text-[10px] font-black mt-1 uppercase">Scan</span></button>
        <button className="flex flex-col items-center text-gray-600"><FileText className="w-6 h-6" /><span className="text-[10px] font-black mt-1 uppercase">Inventário</span></button>
      </nav>
    </div>
  );
}
