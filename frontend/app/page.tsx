'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera, Zap, BarChart3, Settings, X, Loader2,
  Plus, Minus, RefreshCw, FileText, BookOpen,
  Newspaper, Trash2, Wifi, WifiOff,
  Sparkles, Brain, AlertCircle, CheckCircle2,
  ChevronDown, Download,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────
interface Publication { code: string; name: string; type: string; calibrations: number; }
interface InventoryRecord {
  id: number; pub_code: string; pub_name: string;
  qty: number; month: number; year: number;
  mode: string; confidence: number; ts: number;
}
interface ReportRow {
  pub_code: string; pub_name: string; total: number;
  entries: number; avg_conf: number; accuracy: number | null; samples: number;
}
interface AIStatus { ready: boolean; model: string; checking: boolean; }

// ── Constants ──────────────────────────────────────────────────────
const MN = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const PUB_ICONS: Record<string,string> = { revista:'📰', folheto:'📄', livro:'📚', jornal:'🗞', catalogo:'📋' };
const DEFAULT_PUBS: Publication[] = [
  { code:'g20.3-T',    name:'A Sentinela',  type:'revista',  calibrations:0 },
  { code:'wlp26.01-T', name:'Despertai!',   type:'revista',  calibrations:0 },
  { code:'Ifb-T',      name:'Informativo',  type:'folheto',  calibrations:0 },
  { code:'lr-T',       name:'Leia-me',      type:'folheto',  calibrations:0 },
];
const API = (process.env.NEXT_PUBLIC_API_URL || 'https://stackcount-pro-production.up.railway.app').replace(/\/$/, '');

// ── Local storage helpers ──────────────────────────────────────────
const ls = {
  get: <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ── Sub-components ─────────────────────────────────────────────────
function AIBadge({ s }: { s: AIStatus }) {
  if (s.checking) return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
      <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />
      <span className="text-[10px] font-mono text-yellow-400 tracking-wide">verificando IA</span>
    </div>
  );
  return s.ready ? (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" />
      <Sparkles className="w-3 h-3 text-green-400" />
      <span className="text-[10px] font-mono text-green-400 tracking-wide">{s.model || 'gemini'}</span>
    </div>
  ) : (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      <Brain className="w-3 h-3 text-red-400" />
      <span className="text-[10px] font-mono text-red-400 tracking-wide">IA offline</span>
    </div>
  );
}

function ConfBar({ v, className = '' }: { v: number; className?: string }) {
  const c = v >= 80 ? 'bg-green-400' : v >= 55 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className={`w-full h-1.5 bg-white/10 rounded-full overflow-hidden ${className}`}>
      <div className={`h-full ${c} rounded-full transition-all duration-700`} style={{ width: `${Math.min(100,v)}%` }} />
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState<'scan'|'report'|'settings'>('scan');
  const [phase, setPhase] = useState<'idle'|'camera'|'result'>('idle');
  const [ai, setAi] = useState<AIStatus>({ ready: false, model: '', checking: true });

  // publications & records
  const [pubs, setPubs] = useState<Publication[]>(() => ls.get('sc_pubs', DEFAULT_PUBS));
  const [selPub, setSelPub] = useState<Publication | null>(null);
  const [recs, setRecs] = useState<InventoryRecord[]>(() => ls.get('sc_recs', []));

  // scan state
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aiCount, setAiCount] = useState<number | null>(null);
  const [realCount, setRealCount] = useState(0);
  const [conf, setConf] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState('');

  // report
  const [reportMonth, setReportMonth] = useState(new Date().getMonth());
  const [reportYear] = useState(new Date().getFullYear());
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);

  // settings form
  const [npCode, setNpCode] = useState('');
  const [npName, setNpName] = useState('');
  const [npType, setNpType] = useState('revista');

  // toast
  const [toast, setToast] = useState<{ msg:string; type:'ok'|'err'|'info' }|null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const now = new Date();
  const curMo = now.getMonth(), curYr = now.getFullYear();

  // ── persist ──
  useEffect(() => { ls.set('sc_pubs', pubs); }, [pubs]);
  useEffect(() => { ls.set('sc_recs', recs); }, [recs]);

  // ── init ──
  useEffect(() => {
    if (!selPub && pubs.length) setSelPub(pubs[0]);
    checkAI();
    syncPubs();
  }, []);

  useEffect(() => { if (tab === 'report') buildReport(); }, [tab, reportMonth, recs]);

  // ── toast helper ──
  const toast_ = useCallback((msg: string, type: 'ok'|'err'|'info' = 'ok', ms = 3200) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), ms);
  }, []);

  // ── AI health ──
  const checkAI = async () => {
    setAi(s => ({ ...s, checking: true }));
    try {
      const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(7000) });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setAi({ ready: d.ai === 'online', model: d.model || 'gemini-2.0-flash', checking: false });
    } catch {
      setAi({ ready: false, model: '', checking: false });
    }
  };

  // ── sync publications from backend ──
  const syncPubs = async () => {
    try {
      const r = await fetch(`${API}/publications`, { signal: AbortSignal.timeout(6000) });
      if (!r.ok) return;
      const d: Publication[] = await r.json();
      if (d.length > 0) {
        setPubs(d);
        setSelPub(prev => prev ? (d.find(p => p.code === prev.code) || d[0]) : d[0]);
      }
    } catch {}
  };

  // ── Camera ──
  const startCamera = async () => {
    setPhase('camera');
    const strategies = [
      { video: { facingMode: { exact: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
      { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { facingMode: 'environment' } },
      { video: true },
    ];
    for (const c of strategies) {
      try {
        const s = await navigator.mediaDevices.getUserMedia(c);
        streamRef.current = s;
        if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
        return;
      } catch {}
    }
    toast_('Câmera indisponível — use upload de foto', 'err');
    setPhase('idle');
  };

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth || 1280; c.height = v.videoHeight || 720;
    c.getContext('2d')?.drawImage(v, 0, 0);
    stopCamera();
    c.toBlob(b => { if (b) { setBlob(b); setPreviewUrl(URL.createObjectURL(b)); analyze(b); } }, 'image/jpeg', 0.92);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    stopCamera();
    setPreviewUrl(URL.createObjectURL(f));
    setBlob(f);
    analyze(f);
    e.target.value = '';
  };

  // ── AI Analysis ──
  const analyze = async (imgBlob: Blob) => {
    if (!selPub) { toast_('Selecione uma publicação', 'err'); return; }
    setPhase('result'); setLoading(true); setLoadMsg('Enviando para Gemini Vision...');
    const fd = new FormData();
    fd.append('image', imgBlob, 'stack.jpg');
    fd.append('pub_code', selPub.code);
    fd.append('pub_name', selPub.name);
    fd.append('edge_count', '0');
    fd.append('edge_conf', '0');
    try {
      const r = await fetch(`${API}/predict`, { method: 'POST', body: fd, signal: AbortSignal.timeout(35000) });
      const d = await r.json();
      const n = typeof d.ai_count === 'number' ? d.ai_count : 0;
      const c2 = typeof d.confidence === 'number' ? d.confidence : (d.ai_ready ? 72 : 40);
      setAiCount(n); setRealCount(n); setConf(c2);
      setAi(s => ({ ...s, ready: d.ai_ready !== false, model: d.model || s.model }));
      if (!d.ai_ready) toast_('IA offline — ajuste manualmente', 'info');
    } catch {
      setAiCount(0); setRealCount(0); setConf(30);
      toast_('Erro de conexão com o backend', 'err');
    } finally { setLoading(false); setLoadMsg(''); }
  };

  // ── Save & Train ──
  const save = async () => {
    if (!selPub) return;
    setLoading(true); setLoadMsg('Salvando e treinando IA...');
    const fd = new FormData();
    fd.append('pub_code', selPub.code); fd.append('pub_name', selPub.name);
    fd.append('ai_count', String(aiCount ?? 0)); fd.append('real_count', String(realCount));
    fd.append('edge_lines', '0'); fd.append('confidence', String(conf));
    fd.append('source', ai.ready ? 'gemini' : 'manual');
    fd.append('month', String(curMo + 1)); fd.append('year', String(curYr));
    if (blob) fd.append('image', blob, 'train.jpg');
    try { await fetch(`${API}/calibrate`, { method: 'POST', body: fd, signal: AbortSignal.timeout(15000) }); } catch {}
    setRecs(prev => [...prev, {
      id: Date.now(), pub_code: selPub.code, pub_name: selPub.name,
      qty: realCount, month: curMo, year: curYr,
      mode: ai.ready ? `Gemini·${aiCount}→${realCount}` : 'manual',
      confidence: conf, ts: Date.now(),
    }]);
    toast_(`✓ ${realCount}× "${selPub.name}" salvo!`);
    reset();
    setLoading(false);
    // Refresh pub list to update calibration count
    syncPubs();
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null); setPreviewUrl(null);
    setAiCount(null); setRealCount(0); setConf(0);
    setPhase('idle');
  };

  // ── Report ──
  const buildReport = async () => {
    // Try backend first
    try {
      const r = await fetch(`${API}/report?year=${reportYear}&month=${reportMonth + 1}`, { signal: AbortSignal.timeout(8000) });
      if (r.ok) { const d = await r.json(); setReportRows(d.monthly || []); return; }
    } catch {}
    // Fallback: build from local records
    const monthRecs = recs.filter(r => r.month === reportMonth && r.year === reportYear);
    const g: Record<string, ReportRow> = {};
    monthRecs.forEach(r => {
      if (!g[r.pub_code]) g[r.pub_code] = { pub_code: r.pub_code, pub_name: r.pub_name, total: 0, entries: 0, avg_conf: 0, accuracy: null, samples: 0 };
      g[r.pub_code].total += r.qty; g[r.pub_code].entries += 1;
      g[r.pub_code].avg_conf = Math.round((g[r.pub_code].avg_conf * (g[r.pub_code].entries-1) + r.confidence) / g[r.pub_code].entries);
    });
    setReportRows(Object.values(g).sort((a,b) => b.total - a.total));
  };

  // ── Export CSV ──
  const exportCSV = () => {
    const monthRecs = recs.filter(r => r.month === reportMonth && r.year === reportYear);
    if (!monthRecs.length) { toast_('Nenhum dado para exportar', 'info'); return; }
    const lines = ['Código,Nome,Quantidade,Modo,Confiança,Data'];
    monthRecs.forEach(r => lines.push(`${r.pub_code},"${r.pub_name}",${r.qty},"${r.mode}",${r.confidence}%,${new Date(r.ts).toLocaleDateString('pt-BR')}`));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = `inventario_${MN[reportMonth]}_${reportYear}.csv`; a.click();
    toast_('CSV exportado!');
  };

  // ── Add Publication ──
  const addPub = async () => {
    if (!npCode.trim() || !npName.trim()) { toast_('Preencha código e nome', 'err'); return; }
    const newPub: Publication = { code: npCode.trim(), name: npName.trim(), type: npType, calibrations: 0 };
    if (pubs.find(p => p.code === newPub.code)) { toast_('Código já existe', 'err'); return; }
    const fd = new FormData();
    fd.append('code', newPub.code); fd.append('name', newPub.name); fd.append('type', newPub.type);
    try { await fetch(`${API}/publications`, { method: 'POST', body: fd, signal: AbortSignal.timeout(8000) }); } catch {}
    setPubs(prev => [...prev, newPub]);
    setNpCode(''); setNpName(''); setNpType('revista');
    toast_(`✓ "${newPub.name}" cadastrada!`);
  };

  const deletePub = async (code: string) => {
    if (!confirm(`Remover "${code}" e todos os dados?`)) return;
    try { await fetch(`${API}/publications/${code}`, { method: 'DELETE' }); } catch {}
    setPubs(prev => prev.filter(p => p.code !== code));
    if (selPub?.code === code) setSelPub(pubs.find(p => p.code !== code) || null);
    toast_('Publicação removida');
  };

  const monthTotal = recs.filter(r => r.month === curMo && r.year === curYr).reduce((a,r)=>a+r.qty,0);
  const monthPubs = new Set(recs.filter(r => r.month === curMo && r.year === curYr).map(r=>r.pub_code)).size;
  const totalSamples = pubs.reduce((a,p) => a + p.calibrations, 0);

  // ════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════
  return (
    <div className="fixed inset-0 bg-[#06060e] text-white flex flex-col select-none" style={{paddingBottom:'env(safe-area-inset-bottom)'}}>
      <canvas ref={canvasRef} className="hidden" />

      {/* Toast */}
      {toast && (
        <div className={`fixed z-50 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-2xl text-sm font-mono shadow-2xl pointer-events-none transition-all
          ${toast.type==='ok'?'bg-green-500/15 border border-green-500/35 text-green-300':toast.type==='err'?'bg-red-500/15 border border-red-500/35 text-red-300':'bg-purple-500/15 border border-purple-500/35 text-purple-300'}`}
          style={{top:'calc(env(safe-area-inset-top) + 14px)'}}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-4 border-b border-white/5 flex-shrink-0"
        style={{paddingTop:'calc(env(safe-area-inset-top) + 10px)', paddingBottom:'10px'}}>
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-orange-500 fill-orange-500 flex-shrink-0" />
          <span className="font-black italic tracking-tight">STACK<span className="text-orange-500">COUNT</span> <span className="text-[9px] font-mono text-orange-500/50 not-italic">PRO</span></span>
        </div>
        <div className="flex items-center gap-2">
          <AIBadge s={ai} />
          <button onClick={checkAI} className="p-1.5 text-white/25 hover:text-white/50 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden min-h-0">

        {/* ══ SCAN TAB ══ */}
        {tab === 'scan' && (
          <div className="h-full flex flex-col">

            {/* Pub selector — hidden during camera */}
            {phase !== 'camera' && (
              <div className="px-4 pt-3 pb-2 flex-shrink-0">
                <p className="text-[10px] font-mono text-white/25 uppercase mb-2 tracking-widest">Publicação</p>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                  {pubs.map(p => (
                    <button key={p.code} onClick={() => setSelPub(p)}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-xs font-mono
                        ${selPub?.code===p.code ? 'bg-orange-500/15 border-orange-500/40 text-orange-300' : 'bg-white/5 border-white/10 text-white/40'}`}>
                      <span>{PUB_ICONS[p.type]||'📄'}</span>
                      <span className="font-bold">{p.code}</span>
                      {p.calibrations > 0 && <span className="w-1.5 h-1.5 rounded-full bg-green-400/70 flex-shrink-0" />}
                    </button>
                  ))}
                  <button onClick={() => setTab('settings')}
                    className="flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl border border-dashed border-white/15 text-white/25 text-xs">
                    <Plus className="w-3 h-3" /> nova
                  </button>
                </div>
                {selPub && (
                  <p className="mt-1 text-[11px] text-white/30">
                    {selPub.name}
                    {selPub.calibrations > 0 && <span className="ml-2 text-green-400/60">{selPub.calibrations} amostras IA</span>}
                  </p>
                )}
              </div>
            )}

            {/* Camera / result area */}
            <div className="flex-1 px-4 pb-3 min-h-0">
              <div className="h-full rounded-3xl overflow-hidden border border-white/8 relative bg-black/50">

                {/* ─ IDLE ─ */}
                {phase === 'idle' && (
                  <div className="h-full overflow-y-auto flex flex-col items-center justify-center p-6 gap-5">
                    <div className="w-20 h-20 rounded-3xl bg-orange-500/10 border border-orange-500/15 flex items-center justify-center">
                      <Camera className="w-10 h-10 text-orange-500/50" />
                    </div>
                    <div className="text-center">
                      <p className="text-white/40 text-sm font-medium">Aponte para a lateral da pilha</p>
                      <p className="text-white/20 text-xs mt-1">Lombadas visíveis = melhor precisão</p>
                    </div>
                    <button onClick={startCamera}
                      className="w-full max-w-xs bg-orange-500 hover:bg-orange-400 active:scale-95 transition-all text-black font-black text-lg py-4 rounded-2xl shadow-xl shadow-orange-500/20">
                      ABRIR CÂMERA
                    </button>
                    <div className="flex items-center gap-3 w-full max-w-xs">
                      <div className="flex-1 h-px bg-white/10" /><span className="text-white/20 text-xs">ou</span><div className="flex-1 h-px bg-white/10" />
                    </div>
                    <label className="w-full max-w-xs flex items-center justify-center gap-2 py-3 rounded-2xl border border-white/12 text-white/35 text-sm cursor-pointer hover:border-white/25 transition-colors active:scale-95">
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
                      📂 Usar foto da galeria
                    </label>
                    {/* Month KPIs */}
                    <div className="w-full max-w-xs grid grid-cols-3 gap-2 mt-1">
                      {[
                        { v: monthTotal, l: `total ${MN[curMo]}`, c: 'text-orange-400' },
                        { v: monthPubs,  l: 'publicações', c: 'text-blue-400' },
                        { v: totalSamples, l: 'amostras IA', c: 'text-green-400' },
                      ].map(k => (
                        <div key={k.l} className="bg-white/5 border border-white/8 rounded-2xl p-3 text-center">
                          <div className={`text-xl font-mono font-bold ${k.c}`}>{k.v}</div>
                          <div className="text-[9px] text-white/25 mt-0.5 leading-tight">{k.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ─ CAMERA ─ */}
                {phase === 'camera' && (
                  <>
                    <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-cover" />
                    {/* Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="relative w-[80%] h-[55%] border border-white/20 rounded-2xl">
                        <div className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-2 border-l-2 border-orange-400 rounded-tl-lg" />
                        <div className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-2 border-r-2 border-orange-400 rounded-tr-lg" />
                        <div className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-2 border-l-2 border-green-400 rounded-bl-lg" />
                        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-2 border-r-2 border-green-400 rounded-br-lg" />
                        <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-orange-400 to-transparent opacity-80 scan-line" style={{top:'10%'}} />
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-mono text-white/40 bg-black/50 px-2.5 py-1 rounded-full">
                          LOMBADAS DA PILHA
                        </div>
                      </div>
                    </div>
                    {/* Controls */}
                    <div className="absolute bottom-4 inset-x-4 flex items-center gap-3">
                      <button onClick={() => { stopCamera(); setPhase('idle'); }}
                        className="w-12 h-12 rounded-full bg-black/60 border border-white/15 flex items-center justify-center active:scale-90 transition-transform">
                        <X className="w-5 h-5 text-white/60" />
                      </button>
                      <button onClick={capture}
                        className="flex-1 bg-white text-black font-black text-lg py-4 rounded-2xl shadow-2xl active:scale-95 transition-transform">
                        📸 FOTOGRAFAR
                      </button>
                      <label className="w-12 h-12 rounded-full bg-black/60 border border-white/15 flex items-center justify-center cursor-pointer active:scale-90 transition-transform">
                        <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
                        <FileText className="w-5 h-5 text-white/60" />
                      </label>
                    </div>
                  </>
                )}

                {/* ─ RESULT ─ */}
                {phase === 'result' && (
                  <div className="h-full overflow-y-auto">
                    {/* Preview */}
                    {previewUrl && (
                      <div className="relative h-40 bg-black flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewUrl} alt="captura" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#06060e] via-transparent to-transparent" />
                      </div>
                    )}
                    <div className="p-5">
                      {loading ? (
                        <div className="flex flex-col items-center gap-4 py-10">
                          <div className="relative w-16 h-16">
                            <div className="absolute inset-0 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
                            <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-orange-400" />
                          </div>
                          <p className="text-sm text-white/40 font-mono">{loadMsg}</p>
                          <div className="flex gap-1">
                            {[0,1,2].map(i => (
                              <div key={i} className="w-1.5 h-1.5 rounded-full bg-orange-500/50 pulse-dot" style={{animationDelay:`${i*0.2}s`}} />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Count display */}
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-1">Estimativa IA</p>
                              <div className="text-6xl font-mono font-bold text-orange-400 count-in leading-none">{aiCount ?? '—'}</div>
                              <p className="text-xs text-white/30 mt-1.5">{selPub?.name}</p>
                            </div>
                            <div className="text-right mt-1">
                              <div className={`text-lg font-mono font-bold ${conf>=80?'text-green-400':conf>=55?'text-yellow-400':'text-red-400'}`}>{conf}%</div>
                              <p className="text-[10px] text-white/25 mt-0.5">confiança</p>
                              <p className="text-[9px] font-mono text-white/15 mt-1">{ai.ready ? ai.model : 'edge only'}</p>
                            </div>
                          </div>
                          <ConfBar v={conf} className="mb-5" />

                          {/* Manual adjust */}
                          <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-2">Confirme a quantidade real</p>
                          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-3 mb-3">
                            <button onClick={() => setRealCount(c => Math.max(0,c-10))} className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center active:scale-90 transition-transform text-xs font-mono text-white/40">−10</button>
                            <button onClick={() => setRealCount(c => Math.max(0,c-1))} className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center active:scale-90 transition-transform"><Minus className="w-4 h-4" /></button>
                            <input type="number" inputMode="numeric" value={realCount}
                              onChange={e => setRealCount(Math.max(0, parseInt(e.target.value)||0))}
                              className="flex-1 text-center text-4xl font-mono font-bold bg-transparent outline-none" />
                            <button onClick={() => setRealCount(c => c+1)} className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center active:scale-90 transition-transform"><Plus className="w-4 h-4" /></button>
                            <button onClick={() => setRealCount(c => c+10)} className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center active:scale-90 transition-transform text-xs font-mono text-white/40">+10</button>
                          </div>

                          {aiCount !== null && aiCount !== realCount && aiCount > 0 && (
                            <p className="text-center text-xs font-mono text-yellow-400/50 mb-3">
                              IA aprende: {aiCount} → {realCount} (Δ{realCount-aiCount > 0?'+':''}{realCount-aiCount})
                            </p>
                          )}

                          <div className="flex gap-3">
                            <button onClick={reset} className="flex-1 py-3.5 rounded-2xl border border-white/12 text-white/40 text-sm font-medium active:scale-95 transition-transform">↩ Refazer</button>
                            <button onClick={save} disabled={loading}
                              className="flex-[2] py-3.5 rounded-2xl bg-green-500 text-black font-black text-sm shadow-lg shadow-green-500/15 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> SALVAR E TREINAR</>}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ REPORT TAB ══ */}
        {tab === 'report' && (
          <div className="h-full overflow-y-auto px-4 pt-4 pb-20">
            {/* Month scroll */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3">
              {Array.from({length:6},(_,i)=>{
                const d = new Date(reportYear, new Date().getMonth()-i, 1);
                return {m:d.getMonth(), y:d.getFullYear(), l:`${MN[d.getMonth()]} ${d.getFullYear()}`};
              }).map(({m,y,l})=>(
                <button key={`${y}-${m}`} onClick={() => setReportMonth(m)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-mono transition-all
                    ${reportMonth===m ? 'bg-orange-500/15 border border-orange-500/35 text-orange-300' : 'bg-white/5 border border-white/10 text-white/35'}`}>
                  {l}
                </button>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-3xl font-mono font-bold">{reportRows.reduce((a,r)=>a+r.total,0)}</div>
                  <div className="text-xs text-white/30 mt-1">unidades · {MN[reportMonth]} {reportYear}</div>
                </div>
                <div className="flex gap-3 text-right">
                  <div>
                    <div className="text-xl font-mono font-bold text-orange-400">{reportRows.length}</div>
                    <div className="text-[10px] text-white/25">publicações</div>
                  </div>
                  <button onClick={exportCSV} className="p-2.5 rounded-xl bg-white/8 border border-white/10 active:scale-90 transition-transform" title="Exportar CSV">
                    <Download className="w-4 h-4 text-white/50" />
                  </button>
                </div>
              </div>
            </div>

            {/* Rows */}
            {reportRows.length === 0 ? (
              <div className="text-center py-16 text-white/20 text-sm">Nenhum registro neste mês</div>
            ) : (
              <div className="space-y-3">
                {reportRows.map((row, i) => {
                  const maxT = reportRows[0]?.total || 1;
                  const p = pubs.find(x => x.code === row.pub_code);
                  return (
                    <div key={row.pub_code} className="bg-white/5 border border-white/8 rounded-2xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-white/25 font-mono text-xs w-4 flex-shrink-0">{i+1}</span>
                          <span>{p ? PUB_ICONS[p.type] : '📄'}</span>
                          <div>
                            <div className="font-mono text-sm font-bold">{row.pub_code}</div>
                            <div className="text-[11px] text-white/30">{row.pub_name}</div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-2xl font-mono font-bold text-orange-400">{row.total}</div>
                          {row.accuracy !== null && (
                            <div className={`text-[10px] font-mono ${row.accuracy>=80?'text-green-400':'text-yellow-400'}`}>{row.accuracy}% IA</div>
                          )}
                        </div>
                      </div>
                      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden mb-2">
                        <div className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full"
                          style={{width:`${Math.round(row.total/maxT*100)}%`,transition:'width 0.8s cubic-bezier(.34,1.56,.64,1)'}} />
                      </div>
                      <div className="flex gap-3 text-[10px] text-white/20 font-mono">
                        <span>{row.entries} registros</span>
                        {row.avg_conf > 0 && <span>conf. {row.avg_conf}%</span>}
                        {row.samples > 0 && <span>{row.samples} amostras IA</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Detailed history */}
            {recs.filter(r=>r.month===reportMonth&&r.year===reportYear).length > 0 && (
              <div className="mt-6">
                <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest mb-3">Histórico detalhado</p>
                <div className="space-y-1.5">
                  {[...recs].filter(r=>r.month===reportMonth&&r.year===reportYear).reverse().slice(0,40).map(r => (
                    <div key={r.id} className="flex items-center gap-3 bg-white/3 rounded-xl px-4 py-2.5">
                      <span className="font-mono text-sm text-orange-400 w-8 text-right flex-shrink-0">{r.qty}</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-xs font-bold">{r.pub_code}</span>
                        <span className="text-[10px] text-white/25 ml-2">{r.mode}</span>
                      </div>
                      <span className="text-[10px] font-mono text-white/20 flex-shrink-0">{new Date(r.ts).toLocaleDateString('pt-BR')}</span>
                      <button onClick={() => setRecs(prev => prev.filter(x=>x.id!==r.id))} className="text-white/15 hover:text-red-400 transition-colors flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ SETTINGS TAB ══ */}
        {tab === 'settings' && (
          <div className="h-full overflow-y-auto px-4 pt-4 pb-20 space-y-4">

            {/* AI status card */}
            <div className={`p-4 rounded-2xl border ${ai.ready ? 'bg-green-500/6 border-green-500/18' : 'bg-red-500/6 border-red-500/18'}`}>
              <div className="flex items-center gap-3 mb-3">
                {ai.ready ? <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">Gemini Vision API</div>
                  <div className="text-xs text-white/35 truncate">{ai.ready ? `${ai.model} · online` : 'offline — verificar Railway'}</div>
                </div>
                <button onClick={checkAI} className="p-2 rounded-xl bg-white/5 active:scale-90 transition-transform flex-shrink-0">
                  <RefreshCw className={`w-4 h-4 text-white/35 ${ai.checking ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { v: recs.length, l: 'contagens', c: 'text-orange-400' },
                  { v: recs.reduce((a,r)=>a+r.qty,0), l: 'unidades', c: 'text-green-400' },
                  { v: totalSamples, l: 'amostras IA', c: 'text-purple-400' },
                ].map(k => (
                  <div key={k.l} className="bg-white/5 rounded-xl p-2.5">
                    <div className={`text-lg font-mono font-bold ${k.c}`}>{k.v}</div>
                    <div className="text-[9px] text-white/25 mt-0.5">{k.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Publications */}
            <div>
              <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-3">Publicações cadastradas</p>
              <div className="space-y-2">
                {pubs.map(p => (
                  <div key={p.code} className={`flex items-center gap-3 bg-white/5 border rounded-xl px-3 py-3 ${selPub?.code===p.code?'border-orange-500/25':'border-white/8'}`}>
                    <button onClick={() => { setSelPub(p); setTab('scan'); }} className="flex items-center gap-2 flex-1 text-left">
                      <span className="text-lg">{PUB_ICONS[p.type]||'📄'}</span>
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-bold">{p.code}</div>
                        <div className="text-xs text-white/30 truncate">{p.name} · {p.type}</div>
                      </div>
                      {p.calibrations > 0 && (
                        <span className="ml-auto text-[9px] font-mono text-green-400/60 bg-green-500/8 px-2 py-0.5 rounded-full flex-shrink-0">
                          {p.calibrations} amostras
                        </span>
                      )}
                    </button>
                    <button onClick={() => deletePub(p.code)} className="text-white/15 hover:text-red-400 transition-colors flex-shrink-0 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add new */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-3">Nova publicação</p>
              <input value={npCode} onChange={e => setNpCode(e.target.value)} placeholder="Código (ex: g20.3-T)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono mb-2 outline-none focus:border-orange-500/35 transition-colors" />
              <input value={npName} onChange={e => setNpName(e.target.value)} placeholder="Nome (ex: A Sentinela)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm mb-2 outline-none focus:border-orange-500/35 transition-colors" />
              <select value={npType} onChange={e => setNpType(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm mb-3 outline-none bg-[#0e0e1c]">
                <option value="revista">📰 Revista</option>
                <option value="folheto">📄 Folheto</option>
                <option value="livro">📚 Livro</option>
                <option value="jornal">🗞 Jornal</option>
                <option value="catalogo">📋 Catálogo</option>
              </select>
              <button onClick={addPub} className="w-full py-3 bg-orange-500 text-black font-bold rounded-xl active:scale-95 transition-transform">
                Cadastrar publicação
              </button>
            </div>

            {/* Backend info */}
            <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
              <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest mb-2">Backend Railway</p>
              <p className="font-mono text-xs text-white/25 break-all mb-2">{API}</p>
              <div className="flex items-center gap-2">
                {ai.ready ? <><Wifi className="w-3.5 h-3.5 text-green-400" /><span className="text-xs text-green-400">Conectado · {ai.model}</span></>
                  : <><WifiOff className="w-3.5 h-3.5 text-red-400" /><span className="text-xs text-red-400">Desconectado</span></>}
              </div>
            </div>

            {/* Danger zone */}
            <button onClick={() => { if (confirm('Apagar todos os registros locais?')) { setRecs([]); toast_('Dados locais apagados'); } }}
              className="w-full py-3 rounded-xl border border-red-500/15 text-red-400/50 text-sm active:scale-95 transition-transform">
              Limpar registros locais
            </button>
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="flex-shrink-0 flex bg-black/70 border-t border-white/6 backdrop-blur-sm"
        style={{paddingBottom:'env(safe-area-inset-bottom)'}}>
        {([
          { id:'scan', label:'Scanner', Icon:Camera },
          { id:'report', label:'Relatório', Icon:BarChart3 },
          { id:'settings', label:'Config', Icon:Settings },
        ] as {id:'scan'|'report'|'settings', label:string, Icon:React.ComponentType<{className?:string}>}[]).map(({id,label,Icon}) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${tab===id?'text-orange-400':'text-white/20'}`}>
            <Icon className="w-5 h-5" />
            <span className="text-[9px] font-mono">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
