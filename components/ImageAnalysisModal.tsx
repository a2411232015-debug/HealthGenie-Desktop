import React, { useState } from 'react';
import { ICONS } from '../constants';
import { analyzeFoodImage, fileToGenerativePart } from '../services/geminiService';
import { AnalysisResult } from '../types';
import { showToast } from '../utils/notifications';

interface ImageAnalysisModalProps {
  onClose: () => void;
}

export const ImageAnalysisModal: React.FC<ImageAnalysisModalProps> = ({ onClose }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('圖片格式錯誤，請選擇 JPG 或 PNG', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('圖片上傳失敗，檔案需小於 10MB', 'error');
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
  };

  const handleAnalyze = async () => {
    if (!selectedFile || loading) return;
    setLoading(true);
    try {
      const base64 = await fileToGenerativePart(selectedFile);
      setResult(await analyzeFoodImage(base64, selectedFile.type));
      showToast('營養分析已完成');
    } catch (error) {
      showToast(error instanceof Error ? `分析失敗：${error.message}` : '分析失敗，請重試', 'error');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    setResult(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 flex justify-between bg-teal-50">
          <h3 className="font-bold text-teal-800 flex items-center gap-2">{ICONS.Camera} AI 食物營養分析</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="p-6 overflow-y-auto">
          {!previewUrl ? (
            <label className="block border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:bg-slate-50">
              <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFileChange} />
              <span className="mx-auto w-12 h-12 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center">{ICONS.Upload}</span>
              <span className="block text-slate-600 font-medium mt-3">點擊上傳食物照片</span>
              <span className="block text-slate-400 text-sm mt-1">支援 JPG、PNG，最大 10MB</span>
            </label>
          ) : (
            <div className="space-y-4">
              <img src={previewUrl} alt="待分析食物" className="w-full h-48 object-cover rounded-lg" />
              {!result && (
                <button onClick={handleAnalyze} disabled={loading} className="w-full py-3 bg-teal-600 disabled:bg-teal-300 text-white rounded-lg font-bold flex items-center justify-center gap-2">
                  {loading ? <>{ICONS.Loading} 分析中……</> : <>{ICONS.Magic} 開始分析</>}
                </button>
              )}
            </div>
          )}
          {result && (
            <div className="mt-6 space-y-4">
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                <h4 className="font-bold text-emerald-800 text-lg">{result.foodName}</h4>
                <p className="text-emerald-700 mt-2">🔥 {result.calories}</p>
                <p className="text-emerald-900 text-sm mt-2">{result.nutrients}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg"><p className="text-sm text-slate-600">{result.advice}</p></div>
              <button onClick={reset} className="w-full py-2 text-slate-500">分析下一張</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
