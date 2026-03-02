
import React, { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import Button from './components/Button';
import { BatchItem, ImageState, EditPreset, HistoryItem } from './types';
import { PRESETS_PROMPTS } from './constants';
import { editImage } from './services/geminiService';
import JSZip from 'jszip';

const LOADING_MESSAGES = [
  "Ανίχνευση ανθρώπινης παρουσίας...",
  "Βαθμονόμηση χρωματικής λαμπρότητας...",
  "Εφαρμογή υπερ-κρυσταλλικής όξυνσης...",
  "Οριστικοποίηση επιπέδου περιοδικού..."
];

const App: React.FC = () => {
  const [state, setState] = useState<ImageState>({
    items: [],
    isProcessing: false,
  });
  const [customPrompt, setCustomPrompt] = useState('');
  const [targetIndex, setTargetIndex] = useState<string>('all');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let interval: number;
    if (state.isProcessing) {
      interval = window.setInterval(() => {
        setLoadingMsgIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [state.isProcessing]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const limitedFiles = files.slice(0, 10 - state.items.length);
    const newItems: BatchItem[] = [];

    for (const file of limitedFiles) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error("Failed to read file"));
        };
        reader.onerror = () => reject(new Error("File reading error"));
        reader.readAsDataURL(file as Blob);
      });

      newItems.push({
        id: crypto.randomUUID(),
        original: base64,
        edited: null,
        status: 'pending'
      });
    }

    setState(prev => ({
      ...prev,
      items: [...prev.items, ...newItems].slice(0, 10)
    }));
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processBatch = async (preset?: EditPreset, specificId?: string) => {
    if (state.items.length === 0 || state.isProcessing) return;

    setState(prev => ({ ...prev, isProcessing: true }));
    const promptToUse = preset && preset !== EditPreset.Custom 
      ? PRESETS_PROMPTS[preset as keyof typeof PRESETS_PROMPTS] 
      : customPrompt;

    const updatedItems = [...state.items];
    const itemsToProcess = specificId 
      ? updatedItems.filter(item => item.id === specificId)
      : updatedItems;

    for (const item of itemsToProcess) {
      const idx = updatedItems.findIndex(i => i.id === item.id);
      if (idx === -1) continue;

      updatedItems[idx].status = 'processing';
      updatedItems[idx].error = undefined;
      setState(prev => ({ ...prev, items: [...updatedItems] }));

      try {
        const result = await editImage(updatedItems[idx].original, promptToUse);
        updatedItems[idx].edited = result.image;
        updatedItems[idx].status = 'done';
        setSessionCount(prev => prev + 1);
        
        const histItem: HistoryItem = {
          id: crypto.randomUUID(),
          original: updatedItems[idx].original,
          edited: result.image,
          prompt: promptToUse.substring(0, 30),
          timestamp: Date.now()
        };
        setHistory(prev => [histItem, ...prev].slice(0, 10));

      } catch (err: any) {
        updatedItems[idx].status = 'error';
        updatedItems[idx].error = err.message;
      }

      setState(prev => ({ ...prev, items: [...updatedItems] }));
    }

    setState(prev => ({ ...prev, isProcessing: false }));
  };

  const handleTerminalExecute = () => {
    if (targetIndex === 'all') {
      processBatch(EditPreset.Custom);
    } else {
      const item = state.items[parseInt(targetIndex)];
      if (item) processBatch(EditPreset.Custom, item.id);
    }
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    const doneItems = state.items.filter(item => item.edited);
    if (doneItems.length === 0) return;

    doneItems.forEach((item, index) => {
      const base64Data = item.edited!.split(',')[1];
      zip.file(`lumina-retouch-${index + 1}.jpg`, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: 'blob' }) as Blob;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `lumina-batch-export-${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const removeItem = (id: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  const reset = () => {
    setState({ items: [], isProcessing: false });
    setCustomPrompt('');
    setTargetIndex('all');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] selection:bg-blue-500/30">
      <Header />
      
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        multiple 
        accept="image/*" 
        onChange={handleFileUpload} 
      />

      <main className="flex-1 flex flex-col md:flex-row p-4 md:p-8 gap-8 overflow-hidden">
        {/* Sidebar Controls */}
        <div className="w-full md:w-80 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar pb-10">
          
          <section className="glass rounded-3xl p-6 border-blue-500/20 bg-blue-500/[0.02] shadow-2xl shadow-blue-500/5">
            <h2 className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] mb-4">Ενέργειες Δέσμης</h2>
            
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => processBatch(EditPreset.VibrantMagazine)} 
                isLoading={state.isProcessing && targetIndex === 'all'} 
                disabled={state.items.length === 0 || state.isProcessing} 
                className="w-full text-[10px] py-4"
                icon={<i className="fa-solid fa-bolt-lightning"></i>}
              >
                ΕΠΕΞΕΡΓΑΣΙΑ ΟΛΩΝ
              </Button>

              {state.items.some(i => i.status === 'done') && (
                <Button 
                  onClick={downloadZip} 
                  variant="secondary"
                  className="w-full text-[10px] py-4"
                  icon={<i className="fa-solid fa-file-zipper"></i>}
                >
                  ΛΗΨΗ ΟΛΩΝ (.ZIP)
                </Button>
              )}
            </div>
          </section>

          <section className="glass rounded-3xl p-6 flex flex-col gap-4">
            <h2 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Presets (Batch)</h2>
            <button 
              onClick={() => processBatch(EditPreset.VibrantMagazine)} 
              disabled={state.items.length === 0 || state.isProcessing} 
              className="group flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-all disabled:opacity-20"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400"><i className="fa-solid fa-wand-magic-sparkles"></i></div>
              <span className="text-[11px] font-black text-white uppercase tracking-tighter">Vibrant Magazine</span>
            </button>
            
            <button 
              onClick={() => processBatch(EditPreset.GoldenHour)} 
              disabled={state.items.length === 0 || state.isProcessing} 
              className="group flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-all disabled:opacity-20"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400"><i className="fa-solid fa-sun"></i></div>
              <span className="text-[11px] font-black text-white uppercase tracking-tighter">Golden Hour</span>
            </button>

            <Button onClick={reset} variant="danger" className="w-full text-[10px] py-3 mt-2" icon={<i className="fa-solid fa-trash-can"></i>}>
              ΚΑΘΑΡΙΣΜΟΣ STUDIO
            </Button>
          </section>

          <section className="glass rounded-3xl p-6 border-white/5 bg-white/[0.01]">
            <h2 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-4 flex justify-between">
              Τερματικό AI 
              <span className="text-blue-500/60">Targeted</span>
            </h2>
            
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest px-1">Στόχος Επεξεργασίας</label>
                <select 
                  value={targetIndex}
                  onChange={(e) => setTargetIndex(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] text-white focus:outline-none focus:border-blue-500/50 appearance-none"
                  disabled={state.isProcessing || state.items.length === 0}
                >
                  <option value="all">Όλες οι φωτογραφίες</option>
                  {state.items.map((_, idx) => (
                    <option key={idx} value={idx}>Φωτογραφία #{idx + 1}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest px-1">Οδηγία Retouch</label>
                <textarea 
                  value={customPrompt} 
                  onChange={(e) => setCustomPrompt(e.target.value)} 
                  placeholder="π.χ. 'Κάνε τη θάλασσα πιο μπλε'..." 
                  className="w-full h-24 bg-black/40 border border-white/10 rounded-xl p-3 text-[10px] text-white focus:outline-none focus:border-blue-500 transition-all resize-none custom-scrollbar" 
                />
              </div>

              <Button 
                onClick={handleTerminalExecute} 
                isLoading={state.isProcessing} 
                disabled={state.items.length === 0 || !customPrompt.trim()} 
                variant="outline"
                className="w-full text-[10px] py-3.5 border-blue-500/20 hover:border-blue-500/50" 
                icon={<i className="fa-solid fa-microchip"></i>}
              >
                {targetIndex === 'all' ? 'Εκτέλεση σε όλες' : `Εκτέλεση στη #${parseInt(targetIndex) + 1}`}
              </Button>
            </div>
          </section>

          {history.length > 0 && (
            <section className="glass rounded-3xl p-6">
              <h2 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-4">Πρόσφατα</h2>
              <div className="flex flex-col gap-3">
                {history.map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.02] border border-white/5">
                    <img src={item.edited} className="w-8 h-8 rounded-lg object-cover" />
                    <span className="text-[8px] text-white/40 uppercase tracking-widest truncate w-24">{item.prompt}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Main Batch Area */}
        <div className="flex-1 flex flex-col gap-6 relative min-h-[500px]">
          {state.items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full max-w-2xl aspect-video border-4 border-dashed border-blue-500/20 hover:border-blue-500/50 rounded-[3rem] flex flex-col items-center justify-center gap-8 cursor-pointer transition-all bg-blue-500/[0.02] hover:bg-blue-500/[0.05] group animate-pulse"
              >
                <div className="w-32 h-32 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 text-5xl group-hover:scale-110 transition-transform shadow-[0_0_50px_rgba(59,130,246,0.2)]">
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                </div>
                <div className="text-center">
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">ΑΝΕΒΑΣΤΕ ΤΙΣ ΦΩΤΟΓΡΑΦΙΕΣ</h3>
                  <p className="text-blue-400/60 font-bold uppercase tracking-[0.3em] text-sm">Έως 10 αρχεία ταυτόχρονα</p>
                </div>
                <div className="px-8 py-3 bg-blue-600 rounded-full text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20">
                  ΕΠΙΛΟΓΗ ΑΡΧΕΙΩΝ
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 glass rounded-[2.5rem] p-8 overflow-y-auto custom-scrollbar bg-grid">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {state.items.map((item, idx) => {
                  const isTargeted = targetIndex !== 'all' && parseInt(targetIndex) === idx;
                  return (
                    <div 
                      key={item.id} 
                      className={`relative aspect-[4/3] rounded-3xl overflow-hidden border-2 transition-all duration-300 group ${isTargeted ? 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)] scale-[1.02]' : 'border-white/5 bg-black'}`}
                    >
                      {/* Number Badge */}
                      <div className="absolute top-4 left-4 z-20 w-8 h-8 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-black text-xs shadow-lg">
                        {idx + 1}
                      </div>

                      <img 
                        src={item.edited || item.original} 
                        className={`w-full h-full object-cover transition-all duration-700 ${item.status === 'processing' ? 'blur-sm scale-110 opacity-50' : ''}`} 
                      />
                      
                      {/* Status Overlays */}
                      {item.status === 'processing' && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-blue-900/40 backdrop-blur-sm">
                          <div className="w-12 h-12 border-4 border-blue-400/20 border-t-blue-400 rounded-full animate-spin mb-4 shadow-2xl"></div>
                          <span className="text-[10px] font-black text-white uppercase tracking-widest text-center px-4 leading-tight">
                            {LOADING_MESSAGES[loadingMsgIndex]}
                          </span>
                        </div>
                      )}

                      {item.status === 'done' && (
                        <div className="absolute top-4 right-4 z-20 w-8 h-8 bg-green-500 rounded-xl flex items-center justify-center text-white shadow-lg animate-in zoom-in ring-4 ring-green-500/20">
                          <i className="fa-solid fa-check"></i>
                        </div>
                      )}

                      {item.status === 'error' && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-red-900/60 p-4 text-center">
                          <i className="fa-solid fa-triangle-exclamation text-white text-2xl mb-2"></i>
                          <span className="text-[8px] font-bold text-white uppercase leading-tight">{item.error}</span>
                        </div>
                      )}

                      {/* Quick Actions */}
                      <div className="absolute inset-x-0 bottom-0 z-20 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent translate-y-full group-hover:translate-y-0 transition-transform">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-bold text-white uppercase tracking-widest bg-blue-500/20 px-2 py-1 rounded-md border border-blue-500/20">
                            {item.status === 'done' ? 'EDITED 800x600' : 'ORIGINAL'}
                          </span>
                          <button 
                            onClick={() => removeItem(item.id)}
                            className="w-10 h-10 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all flex items-center justify-center border border-red-500/20"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Add more slot */}
                {state.items.length < 10 && !state.isProcessing && (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-[4/3] rounded-3xl border-2 border-dashed border-white/10 hover:border-blue-500/30 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all hover:bg-blue-500/[0.05] hover:border-blue-500/50"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center text-white/10 text-xl border border-white/5">
                      <i className="fa-solid fa-plus"></i>
                    </div>
                    <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Προσθήκη ({10 - state.items.length})</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="flex justify-between items-center px-4">
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${state.isProcessing ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                  Studio Session Active
                </span>
              </div>
              <div className="h-4 w-px bg-white/10 mx-2"></div>
              <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
                Batch Count: <span className="text-blue-400">{state.items.length}/10</span>
              </div>
            </div>
            <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
              Vibrant Batch Engine v4.2.0
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
