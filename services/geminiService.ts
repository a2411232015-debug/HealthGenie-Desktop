import { GoogleGenAI, Type } from '@google/genai';
import { AnalysisResult } from '../types';

export const fileToGenerativePart = async (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const data = result.split(',')[1];
      if (data) resolve(data);
      else reject(new Error('圖片資料格式錯誤'));
    };
    reader.onerror = () => reject(new Error('圖片讀取失敗'));
    reader.readAsDataURL(file);
  });

const getAiClient = (): GoogleGenAI => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key');
  if (!apiKey) throw new Error('尚未設定 Gemini API Key');
  return new GoogleGenAI({ apiKey });
};

export const analyzeFoodImage = async (
  base64Image: string,
  mimeType: string,
): Promise<AnalysisResult> => {
  const response = await getAiClient().models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64Image } },
        { text: '請分析圖片中的食物，回傳 JSON：foodName、calories、nutrients、advice，使用繁體中文。' },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          foodName: { type: Type.STRING },
          calories: { type: Type.STRING },
          nutrients: { type: Type.STRING },
          advice: { type: Type.STRING },
        },
      },
    },
  });
  const parsed = JSON.parse(response.text || '{}') as Partial<AnalysisResult>;
  if (!parsed.foodName) throw new Error('AI 回傳資料格式錯誤');
  return {
    foodName: parsed.foodName,
    calories: parsed.calories || '尚未提供',
    nutrients: parsed.nutrients || '尚未提供',
    advice: parsed.advice || '尚未提供',
  };
};

export const editImage = async (
  base64Image: string,
  mimeType: string,
  prompt: string,
): Promise<string> => {
  const response = await getAiClient().models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType } },
        { text: prompt },
      ],
    },
  });
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  }
  throw new Error('AI 未產生圖片');
};

export const getNearbyHealthyFood = async (
  latitude: number,
  longitude: number,
  query = '健康的午餐選擇',
) => {
  const response = await getAiClient().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `我在這個位置（緯度：${latitude}，經度：${longitude}）。${query}。請推薦附近 3-5 家適合的餐廳。`,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: { retrievalConfig: { latLng: { latitude, longitude } } },
    },
  });
  return {
    text: response.text,
    groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
  };
};
