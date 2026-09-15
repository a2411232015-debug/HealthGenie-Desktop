import React, { useState } from 'react';
import { ICONS } from '../constants';
import { editImage, fileToGenerativePart } from '../services/geminiService';
import { showToast } from '../utils/notifications';

interface ImageEditorModalProps {
  onClose: () => void;
}

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({ onClose }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editedUrl, setEditedUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('圖片格式錯誤，請重新選擇圖片', 'error');
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setEditedUrl(null);
  };

  const resetImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    setEditedUrl(null);
  };

  const handleEdit = async () => {
    if (!selectedFile || !prompt.trim() || loading) return;
    setLoading(true);
    setEditedUrl(null);
    try {
      const base64 = await fileToGenerativePart(selectedFile);
      setEditedUrl(await editImage(base64, selectedFile.type, prompt.trim()));
      showToast('圖片編輯已完成');
    } catch (error) {
      showToast(error instanceof Error ? `圖片編輯失敗：${error.message}` : '圖片編輯失敗，請稍後再試', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden text-white">
        <div className="p-4 border-b border-slate-700 flex justify-between">
          <h3 className="font-bold text-emerald-400 flex items-center gap-2">{ICONS.Magic} AI 創意工作室</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-6 grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-bold text-slate-400 mb-2">原始圖片</p>
            {!previewUrl ? (
              <label className="aspect-square border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                {ICONS.Upload}
                <span className="text-sm text-slate-400 mt-2">上傳圖片</span>
              </label>
            ) : (
              <div className="relative">
                <img src={previewUrl} alt="原始圖片" className="w-full aspect-square object-cover rounded-xl" />
                <button onClick={resetImage} className="absolute top-2 right-2 bg-black/60 p-2 rounded-full">✕</button>
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 mb-2">AI 生成結果</p>
            <div className="aspect-square bg-slate-950 rounded-xl flex items-center justify-center overflow-hidden">
              {loading ? <div className="text-emerald-500 text-center">{ICONS.Loading}<p className="text-sm mt-2">AI 正在處理……</p></div>
                : editedUrl ? <img src={editedUrl} alt="編輯結果" className="w-full h-full object-cover" />
                  : <p className="text-slate-600 text-sm">等待圖片與指令</p>}
            </div>
          </div>
        </div>
        <div className="p-4 bg-slate-800 border-t border-slate-700 flex gap-2">
          <input value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && handleEdit()} placeholder="輸入圖片編輯指令" className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3" />
          <button onClick={handleEdit} disabled={loading || !selectedFile || !prompt.trim()} className="bg-emerald-500 disabled:bg-slate-700 px-6 rounded-lg font-bold">{ICONS.Magic} 生成</button>
        </div>
      </div>
    </div>
  );
};
