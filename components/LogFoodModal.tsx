import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { Camera, Search, Check, Loader2, Utensils } from 'lucide-react';

interface LogFoodModalProps {
  onClose: () => void;
  onLog: (calories: number, foodName: string) => void;
}

export const LogFoodModal: React.FC<LogFoodModalProps> = ({ onClose, onLog }) => {
  const [mode, setMode] = useState<'select' | 'scanning' | 'manual' | 'result'>('select');
  const [scanProgress, setScanProgress] = useState(0);
  const [detectedFood, setDetectedFood] = useState({ name: '舒肥雞胸肉沙拉', calories: 450 });

  // Simulate Scanning Process
  useEffect(() => {
    if (mode === 'scanning') {
      const interval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setMode('result');
            return 100;
          }
          return prev + 2; // finish in ~2-3 seconds
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [mode]);

  const handleConfirm = () => {
    onLog(detectedFood.calories, detectedFood.name);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-[100] p-4">
      <div className="bg-white w-full max-w-md rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
        
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <span className="bg-primary-100 text-primary-600 p-1.5 rounded-lg">
              <Utensils className="w-4 h-4" />
            </span>
            記錄飲食
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2">✕</button>
        </div>

        <div className="p-6">
          {mode === 'select' && (
            <div className="space-y-4">
              <button 
                onClick={() => setMode('scanning')}
                className="w-full p-6 border-2 border-dashed border-primary-200 hover:border-primary-500 bg-primary-50 hover:bg-primary-100/50 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group"
              >
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-primary-500 group-hover:scale-110 transition-transform">
                  <Camera className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <span className="font-bold text-primary-700 block text-lg">AI 拍照辨識</span>
                  <span className="text-primary-500 text-xs">自動分析食物與熱量</span>
                </div>
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-400 font-medium">或</span>
                </div>
              </div>

              <button 
                onClick={() => setMode('manual')}
                className="w-full p-4 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center gap-4 text-slate-600 font-medium transition-colors"
              >
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400 border border-slate-200">
                  <Search className="w-5 h-5" />
                </div>
                手動搜尋食物資料庫
              </button>
            </div>
          )}

          {mode === 'scanning' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <div className="relative w-32 h-32">
                {/* Scanner Effect */}
                <div className="absolute inset-0 border-4 border-slate-200 rounded-2xl"></div>
                <div 
                  className="absolute inset-x-0 h-1 bg-primary-500 shadow-[0_0_15px_rgba(20,184,166,0.5)] animate-[scan_2s_ease-in-out_infinite]"
                  style={{ top: `${scanProgress}%` }}
                ></div>
                <img 
                  src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80" 
                  className="w-full h-full object-cover rounded-2xl opacity-80" 
                  alt="Scanning"
                />
              </div>
              <div className="text-center space-y-2">
                <h4 className="font-bold text-slate-700 text-lg">AI 正在分析影像...</h4>
                <div className="w-48 h-2 bg-slate-100 rounded-full overflow-hidden mx-auto">
                  <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${scanProgress}%` }}></div>
                </div>
                <p className="text-xs text-slate-400">正在比對 15,000+ 種食物資料</p>
              </div>
            </div>
          )}

          {mode === 'result' && (
            <div className="animate-in zoom-in-95 duration-300">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 mb-6 text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-emerald-500">
                  <Check className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-emerald-800 text-xl">{detectedFood.name}</h4>
                <p className="text-emerald-600 font-medium mt-1">{detectedFood.calories} kcal</p>
              </div>
              
              <div className="space-y-3">
                <button 
                  onClick={handleConfirm}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-primary-600 transition-colors shadow-lg shadow-slate-200"
                >
                  加入今日記錄
                </button>
                <button 
                  onClick={() => setMode('select')}
                  className="w-full py-3 text-slate-500 font-medium hover:text-slate-700"
                >
                  重新辨識
                </button>
              </div>
            </div>
          )}

          {mode === 'manual' && (
             <div className="text-center py-10">
               <p className="text-slate-500">手動輸入功能建置中...</p>
               <button 
                  onClick={() => setMode('select')}
                  className="mt-4 text-primary-600 underline"
                >
                  返回
                </button>
             </div>
          )}
        </div>
      </div>
      
      {/* CSS for Scan Animation */}
      <style>{`
        @keyframes scan {
          0%, 100% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          50% { top: 100%; }
          90% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
