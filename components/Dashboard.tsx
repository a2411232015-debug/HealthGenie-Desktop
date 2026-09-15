import React, { useMemo, useState } from 'react';
import { ICONS, MOCK_TASKS } from '../constants';
import { UserProfile, ActivityLevel, DailyStats, TaskCategory, TaskItem } from '../types';
import { ImageAnalysisModal } from './ImageAnalysisModal';
import { LogFoodModal } from './LogFoodModal';
import { calculateHealthTargets } from '../utils/health';
import { Plus, Check, X } from 'lucide-react';

interface DashboardProps {
  userProfile: UserProfile;
  stats: DailyStats;
  onAddCalories: (calories: number) => void;
}

// Helper to determine the daily exercise challenge based on profile
const getDailyRecommendation = (profile: UserProfile) => {
  // Simple Mock Logic
  const isSedentary = profile.activityLevel === ActivityLevel.SEDENTARY || profile.activityLevel === ActivityLevel.LIGHT;
  
  if (isSedentary) {
    return {
      type: 'cardio',
      title: '燃脂快走',
      desc: '保持心率 120-140 bpm',
      duration: '40 分鐘',
      calories: '250',
      icon: ICONS.Footprints,
      color: 'bg-orange-100 text-orange-600'
    };
  } else {
    return {
      type: 'strength',
      title: '下肢肌力訓練',
      desc: '徒手深蹲 4組 x 12下',
      duration: '15 分鐘',
      calories: '120',
      icon: ICONS.Dumbbell,
      color: 'bg-indigo-100 text-indigo-600'
    };
  }
};

const StatCard: React.FC<{ 
  title: string; 
  current: number; 
  target: number; 
  unit: string; 
  icon: React.ReactNode;
  colorClass: string;
}> = ({ title, current, target, unit, icon, colorClass }) => {
  const percentage = Math.min(100, Math.round((current / target) * 100));
  
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-full hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2.5 rounded-xl ${colorClass} bg-opacity-10 text-${colorClass.split('-')[1]}-600`}>
          {icon}
        </div>
        <span className="text-slate-400 text-xs font-semibold bg-slate-50 px-2 py-1 rounded-full">{percentage}%</span>
      </div>
      <div>
        <h3 className="text-slate-500 text-xs font-medium mb-1">{title}</h3>
        <div className="flex items-end gap-1 mb-2">
          <span className="text-xl font-bold text-slate-800">{current.toLocaleString()}</span>
          <span className="text-slate-400 text-xs mb-1">/ {target.toLocaleString()} {unit}</span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${colorClass.replace('text', 'bg')} transition-all duration-1000 ease-out`} 
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ userProfile, stats, onAddCalories }) => {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showLogFood, setShowLogFood] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Task Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [taskList, setTaskList] = useState<TaskItem[]>(MOCK_TASKS);

  // Recalculate targets whenever profile changes
  const targets = useMemo(() => calculateHealthTargets(userProfile), [userProfile]);
  const exercise = useMemo(() => getDailyRecommendation(userProfile), [userProfile]);

  const handleFeedback = () => {
    setFeedbackSent(true);
    setToastMessage('已收到回饋，系統將調整明日強度！');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleLogFood = (calories: number, name: string) => {
    onAddCalories(calories);
    setToastMessage(`已記錄：${name} (+${calories} kcal)`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const toggleTask = (taskId: string) => {
    setTaskList(prev => prev.map(task => 
      task.id === taskId ? { ...task, isCompleted: !task.isCompleted } : task
    ));
  };

  const renderTaskCategory = (category: TaskCategory, colorClass: string) => {
    const tasks = taskList.filter(t => t.category === category);
    if (tasks.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className={`font-bold text-sm mb-3 px-3 py-1 rounded-lg inline-block ${colorClass}`}>
          {category}
        </h3>
        <div className="space-y-3">
          {tasks.map(task => (
            <div 
              key={task.id} 
              onClick={() => toggleTask(task.id)}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer group hover:shadow-sm ${
                task.isCompleted 
                  ? 'bg-slate-50 border-slate-100 opacity-60' 
                  : 'bg-white border-slate-200 hover:border-primary-300'
              }`}
            >
              <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                task.isCompleted 
                  ? 'bg-emerald-500 border-emerald-500' 
                  : 'border-slate-300 group-hover:border-primary-500'
              }`}>
                {task.isCompleted && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium transition-all ${
                  task.isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'
                }`}>
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-slate-400 mt-0.5">{task.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative pb-20 md:pb-0">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[150] bg-slate-800 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-in slide-in-from-top-4 fade-in">
          {ICONS.Check}
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Task Drawer Overlay */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm transition-opacity" onClick={() => setIsDrawerOpen(false)} />
      )}

      {/* Task Drawer Panel */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-white z-[70] shadow-2xl transform transition-transform duration-300 ease-in-out ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div>
              <h2 className="text-xl font-bold text-slate-800">今日健康任務</h2>
              <p className="text-xs text-slate-500 mt-1">完成任務，累積健康習慣！</p>
            </div>
            <button 
              onClick={() => setIsDrawerOpen(false)}
              className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-600 hover:shadow-sm"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 bg-white">
            {renderTaskCategory(TaskCategory.EXERCISE, 'bg-orange-100 text-orange-700')}
            {renderTaskCategory(TaskCategory.NUTRITION, 'bg-emerald-100 text-emerald-700')}
            {renderTaskCategory(TaskCategory.HABITS, 'bg-purple-100 text-purple-700')}
            
            <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
              <p className="text-xs text-slate-400">已完成 {taskList.filter(t => t.isCompleted).length} / {taskList.length} 項任務</p>
              <div className="mt-2 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary-500 transition-all duration-500" 
                  style={{ width: `${(taskList.filter(t => t.isCompleted).length / taskList.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Button (FAB) for Logging Food */}
      <button 
        onClick={() => setShowLogFood(true)}
        className="fixed bottom-24 md:bottom-12 right-6 md:right-12 w-14 h-14 bg-primary-600 text-white rounded-full shadow-xl shadow-primary-600/30 flex items-center justify-center hover:bg-primary-500 hover:scale-110 transition-all z-40 group"
      >
        <Plus className="w-8 h-8" />
        <span className="absolute right-full mr-3 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          記錄飲食
        </span>
      </button>

      <header className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">早安，健康探險家 👋</h1>
          <p className="text-slate-500 mt-1 text-sm">
             讓今天成為更健康的一天！ | TDEE: {targets.tdee}
          </p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-sm font-medium text-primary-600 bg-primary-50 px-3 py-1 rounded-full inline-block">
            {new Date().toLocaleDateString('zh-TW', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </header>

      {/* Actionable Section: Daily Tasks + Compact Nutrition */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Horizontal Task List (Carousel) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-700">今日任務清單</span>
              <button 
                onClick={() => setIsDrawerOpen(true)}
                className="text-xs flex items-center gap-1 text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-2 py-1 rounded-lg transition-colors font-bold"
              >
                {ICONS.List} 查看全部
              </button>
            </div>
            <span className="text-xs text-slate-400 font-medium animate-pulse hidden md:block">← 滑動查看更多 →</span>
          </div>

          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-6 -mx-4 px-4 [&::-webkit-scrollbar]:hidden">
            
            {/* Card 1: Exercise (Fixed Width) */}
            <div className="min-w-[85%] md:min-w-[340px] snap-center flex-shrink-0 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group flex flex-col justify-center">
              <div className={`absolute top-0 left-0 w-1.5 h-full ${feedbackSent ? 'bg-slate-300' : 'bg-primary-500'}`}></div>
              <div className="flex gap-4 items-center mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${feedbackSent ? 'bg-slate-100 text-slate-400' : exercise.color}`}>
                  {feedbackSent ? ICONS.Check : exercise.icon}
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${feedbackSent ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                    {exercise.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <span className="flex items-center gap-1">{ICONS.Timer} {exercise.duration}</span>
                    <span>•</span>
                    <span>{exercise.desc}</span>
                  </div>
                </div>
              </div>
              
              {!feedbackSent ? (
                 <div className="bg-slate-50 rounded-xl p-3 flex flex-col gap-2">
                   <span className="text-[10px] text-center text-slate-400 font-medium uppercase tracking-wider">強度回饋</span>
                   <div className="flex gap-2 justify-center">
                     <button onClick={handleFeedback} className="flex-1 py-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-emerald-500 transition-all text-xs flex flex-col items-center gap-1">
                       {ICONS.ThumbsDown}
                     </button>
                     <button onClick={handleFeedback} className="flex-1 py-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-primary-600 transition-all text-xs flex flex-col items-center gap-1">
                       {ICONS.Minus}
                     </button>
                     <button onClick={handleFeedback} className="flex-1 py-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-orange-500 transition-all text-xs flex flex-col items-center gap-1">
                       {ICONS.ThumbsUp}
                     </button>
                   </div>
                 </div>
              ) : (
                <div className="bg-slate-50 rounded-xl p-3 text-center text-xs text-slate-400">
                  <p>已完成！好好休息 💪</p>
                </div>
              )}
            </div>

            {/* Card 2: Log Meal (Interactive) */}
            <div 
              onClick={() => setShowAnalysis(true)}
              className="min-w-[85%] md:min-w-[340px] snap-center flex-shrink-0 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group cursor-pointer hover:border-primary-300 transition-colors flex flex-col justify-center"
            >
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                   {ICONS.Camera}
                 </div>
                 <div>
                   <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-700 transition-colors">記錄午餐</h3>
                   <p className="text-xs text-slate-500 mt-1">AI 拍照自動辨識熱量</p>
                 </div>
                 <div className="ml-auto bg-slate-50 p-2 rounded-full text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-50 transition-all">
                   {ICONS.ArrowRight}
                 </div>
               </div>
               <div className="mt-4 flex gap-2">
                 <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500">📸 營養分析</span>
                 <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500">🥗 飲食建議</span>
               </div>
            </div>

            {/* Card 3: Hydration */}
            <div className="min-w-[85%] md:min-w-[340px] snap-center flex-shrink-0 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden flex flex-col justify-center">
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center flex-shrink-0">
                   {ICONS.Water}
                 </div>
                 <div>
                   <h3 className="text-lg font-bold text-slate-800">下午補水</h3>
                   <p className="text-xs text-slate-500 mt-1">目標：500ml 溫開水</p>
                 </div>
                 <button className="ml-auto px-3 py-1.5 bg-cyan-100 hover:bg-cyan-200 text-cyan-700 rounded-lg text-xs font-bold transition-colors">
                   完成
                 </button>
               </div>
               <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 w-3/5 rounded-full"></div>
               </div>
            </div>

            {/* Card 4: Meditation */}
            <div className="min-w-[85%] md:min-w-[340px] snap-center flex-shrink-0 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden flex flex-col justify-center">
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0">
                   {ICONS.Moon}
                 </div>
                 <div>
                   <h3 className="text-lg font-bold text-slate-800">睡前冥想</h3>
                   <p className="text-xs text-slate-500 mt-1">10 分鐘 • 放鬆身心</p>
                 </div>
                 <button className="ml-auto px-3 py-1.5 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg text-xs font-bold transition-colors">
                   開始
                 </button>
               </div>
               <div className="mt-4 flex gap-2">
                 <span className="text-[10px] bg-violet-50 text-violet-600 px-2 py-1 rounded border border-violet-100">🌙 助眠</span>
                 <span className="text-[10px] bg-violet-50 text-violet-600 px-2 py-1 rounded border border-violet-100">🧘‍♀️ 呼吸練習</span>
               </div>
            </div>

          </div>
        </div>

        {/* Right: Compact Nutrition Chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-center min-h-[200px]">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
            {ICONS.Calories} 營養攝取概況
          </h3>
          <div className="flex items-center gap-6">
            {/* Compact Donut */}
            <div className="relative w-28 h-28 flex-shrink-0">
              <div 
                className="w-full h-full rounded-full"
                style={{
                  background: `conic-gradient(
                    #3b82f6 0% 30%, 
                    #f59e0b 30% 70%, 
                    #10b981 70% 100%
                  )`
                }}
              ></div>
              <div className="absolute inset-3 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                 <span className="text-[10px] text-slate-400">剩餘</span>
                 <span className="text-lg font-black text-slate-800">
                   {Math.max(0, targets.dailyCalories - stats.calories.current)}
                 </span>
              </div>
            </div>

            {/* Compact List */}
            <div className="space-y-3 flex-1">
              <div className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"></div>蛋白質</span>
                <span className="font-medium text-slate-600">30%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div>碳水</span>
                <span className="font-medium text-slate-600">40%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div>脂肪</span>
                <span className="font-medium text-slate-600">30%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          title="卡路里消耗" 
          current={stats.calories.current} 
          target={targets.dailyCalories} 
          unit="kcal" 
          icon={ICONS.Calories}
          colorClass="bg-orange-500 text-orange-500"
        />
        <StatCard 
          title="今日步數" 
          current={stats.steps.current} 
          target={stats.steps.target} 
          unit="步" 
          icon={ICONS.Activity}
          colorClass="bg-emerald-500 text-emerald-500"
        />
        <StatCard 
          title="水分補充" 
          current={stats.water.current} 
          target={stats.water.target} 
          unit="ml" 
          icon={ICONS.Water}
          colorClass="bg-blue-500 text-blue-500"
        />
      </div>

      {/* Modals */}
      {showAnalysis && <ImageAnalysisModal onClose={() => setShowAnalysis(false)} />}
      {showLogFood && <LogFoodModal onClose={() => setShowLogFood(false)} onLog={handleLogFood} />}
    </div>
  );
};