import React, { useState } from 'react';
import { useRoulette } from '../hooks/useRoulette';
import { ArrowLeft } from 'lucide-react';

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export default function Roulette({ onBack }) {
  const { 
    sessionId, isVip, history, analysis, 
    isLoading, error, isSyncing, 
    startSession, syncHistory, addSpin 
  } = useRoulette();

  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncInput, setSyncInput] = useState('');

  const getNumberColor = (num) => {
    if (num === 0) return 'bg-green-600 text-white';
    if (RED_NUMBERS.includes(num)) return 'bg-red-600 text-white';
    return 'bg-gray-800 text-white';
  };

  const handleSyncSubmit = (e) => {
    e.preventDefault();
    const numbers = syncInput.match(/\d+/g)?.map(Number).filter(n => n >= 0 && n <= 36) || [];
    if (numbers.length > 0) {
      syncHistory(numbers);
      setShowSyncModal(false);
      setSyncInput('');
    }
  };

  const renderZScoreCard = (title, data) => {
    if (!data) return null;
    const isAnomaly = Math.abs(data.z_score) >= 2.0;
    return (
      <div className={`p-3 rounded-xl border transition-colors ${isAnomaly ? 'border-red-500 bg-red-500/10' : 'border-gray-800 bg-[#151b2b]'}`}>
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-gray-500">Выпало: {data.count}</span>
          <span className={`font-black text-sm ${isAnomaly ? 'text-red-400' : 'text-gray-200'}`}>
            Z: {data.z_score > 0 ? '+' : ''}{data.z_score}
          </span>
        </div>
      </div>
    );
  };

  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center relative">
        <button 
          onClick={onBack} 
          className="absolute top-4 left-4 text-gray-400 hover:text-white p-2 active:scale-95 transition-transform"
        >
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-3xl font-black mb-4 text-white uppercase tracking-tight">Анализатор Рулетки</h2>
        <p className="text-gray-400 mb-8 max-w-sm text-sm leading-relaxed">
          Ищем статистические аномалии и перекосы вероятностей на основе математического ожидания.
        </p>
        <button 
          onClick={startSession}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-500 text-white font-black py-4 px-8 rounded-2xl w-full max-w-xs transition-colors uppercase tracking-widest shadow-[0_0_20px_rgba(37,99,235,0.3)]"
        >
          {isLoading ? 'Загрузка...' : 'Начать сессию'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-[#0a0f1c] text-white">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 px-3 py-3 bg-[#151b2b] border border-gray-800/50 rounded-2xl shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="text-gray-400 hover:text-white p-1 active:scale-95 transition-transform"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="text-sm text-gray-300 font-bold tracking-wide">СПИНОВ: <span className="text-white">{history.length}</span></div>
        </div>
        <div className="flex gap-2 items-center">
          {!isVip && <span className="text-[9px] font-black bg-yellow-600/20 text-yellow-500 px-2 py-1 rounded uppercase tracking-widest border border-yellow-500/20">Free</span>}
          {isVip && <span className="text-[9px] font-black bg-purple-600/20 text-purple-400 px-2 py-1 rounded uppercase tracking-widest border border-purple-500/20">VIP</span>}
          <button 
            onClick={() => setShowSyncModal(true)}
            className="text-xs font-bold bg-[#0a0f1c] hover:bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            ВВОД ИСТОРИИ
          </button>
        </div>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl mb-4 text-sm mx-1">{error}</div>}

      {/* Dashboard */}
      <div className="flex-1 space-y-4 px-1 mb-6 min-h-[250px]">
        {!analysis ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 bg-[#151b2b]/50 rounded-2xl border border-gray-800 border-dashed">
            <span className="text-4xl mb-3">📊</span>
            <p className="text-sm font-bold uppercase tracking-widest">Дашборд пуст</p>
            <p className="text-xs text-center mt-2 px-6 opacity-70">Вводите выпавшие числа на клавиатуре ниже, чтобы алгоритм начал поиск аномалий.</p>
          </div>
        ) : (
          <>
            {/* Hot / Cold */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#151b2b] p-3 rounded-xl border border-gray-800 shadow-sm">
                <div className="text-[10px] font-black text-red-400 mb-2 uppercase tracking-widest">🔥 Горячие</div>
                <div className="flex gap-1.5 flex-wrap">
                  {analysis?.hot_cold?.hot?.map((n, i) => (
                    <span key={i} className={`w-7 h-7 flex items-center justify-center rounded-md text-sm font-black shadow-sm ${getNumberColor(n)}`}>{n}</span>
                  ))}
                </div>
              </div>
              <div className="bg-[#151b2b] p-3 rounded-xl border border-gray-800 shadow-sm">
                <div className="text-[10px] font-black text-blue-400 mb-2 uppercase tracking-widest">❄️ Холодные</div>
                <div className="flex gap-1.5 flex-wrap">
                  {analysis?.hot_cold?.cold?.map((n, i) => (
                    <span key={i} className={`w-7 h-7 flex items-center justify-center rounded-md text-sm font-black shadow-sm ${getNumberColor(n)}`}>{n}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Z-Scores (Simple Chances) */}
            <div className="space-y-2">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Базовые шансы</h3>
              <div className="grid grid-cols-2 gap-2">
                {renderZScoreCard('Красное', analysis?.chances?.red)}
                {renderZScoreCard('Черное', analysis?.chances?.black)}
                {renderZScoreCard('Четное', analysis?.chances?.even)}
                {renderZScoreCard('Нечетное', analysis?.chances?.odd)}
              </div>
            </div>

            {/* VIP Only Features */}
            {!isVip ? (
              <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/20 p-5 rounded-xl text-center mt-4">
                <h4 className="text-purple-400 text-sm font-black mb-2 tracking-widest uppercase">VIP-ФУНКЦИИ</h4>
                <p className="text-xs text-gray-400 mb-4 leading-relaxed px-2">Анализ секторов колеса (Wheel Tracking) и критических серий доступен только для VIP.</p>
                <button className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-black py-3 px-6 rounded-xl w-full transition-colors uppercase tracking-widest shadow-[0_0_15px_rgba(147,51,234,0.3)]">
                  Купить VIP
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-2 mt-4">
                  <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Сектора колеса</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {renderZScoreCard('Voisins', analysis?.sectors?.voisins)}
                    {renderZScoreCard('Tiers', analysis?.sectors?.tiers)}
                    {renderZScoreCard('Orphelins', analysis?.sectors?.orphelins)}
                    {renderZScoreCard('Jeu Zero', analysis?.sectors?.jeu_zero)}
                  </div>
                </div>

                {analysis?.streaks?.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Критические серии</h3>
                    {analysis.streaks.filter(s => s.is_anomaly).map((streak, i) => (
                      <div key={i} className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex justify-between items-center">
                        <span className="text-sm font-bold text-red-300 uppercase tracking-wider">{streak.property}</span>
                        <span className="text-xs font-black text-red-400 bg-red-500/20 px-2 py-1 rounded-lg">
                          {streak.length} подряд (P: {(streak.probability * 100).toFixed(2)}%)
                        </span>
                      </div>
                    ))}
                    {analysis.streaks.filter(s => s.is_anomaly).length === 0 && (
                      <div className="text-xs text-gray-600 text-center py-4 uppercase tracking-widest font-bold">Аномальных серий не обнаружено</div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* COMPACT Numpad (6 columns instead of 3) */}
      <div className="mt-auto border-t border-gray-800/50 pt-4 pb-2 px-1 bg-[#0a0f1c]">
        <div className="grid grid-cols-6 gap-1.5">
          <button 
            onClick={() => addSpin(0)}
            className="col-span-6 bg-green-600 hover:bg-green-500 text-white font-black py-2 rounded-xl text-lg active:scale-[0.98] transition-all shadow-md"
          >
            0
          </button>
          {[...Array(36)].map((_, i) => {
            const num = i + 1;
            return (
              <button
                key={num}
                onClick={() => addSpin(num)}
                disabled={isLoading}
                className={`${getNumberColor(num)} font-black py-2.5 rounded-xl text-sm active:scale-[0.95] transition-all disabled:opacity-50 shadow-md border border-white/5`}
              >
                {num}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 backdrop-blur-sm">
          <div className="bg-[#151b2b] rounded-3xl p-6 w-full max-w-sm border border-gray-800 shadow-2xl">
            <h3 className="text-2xl font-black mb-2 text-white">ВВОД ИСТОРИИ</h3>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">Вставьте последние выпавшие числа через пробел (например: 32 15 19 4 21)</p>
            <form onSubmit={handleSyncSubmit}>
              <textarea 
                value={syncInput}
                onChange={(e) => setSyncInput(e.target.value)}
                className="w-full h-32 bg-[#0a0f1c] border border-gray-700 rounded-2xl p-4 text-white text-sm mb-6 focus:outline-none focus:border-blue-500 transition-colors shadow-inner font-mono"
                placeholder="32 15 19..."
              />
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowSyncModal(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 py-3 rounded-xl text-xs uppercase tracking-widest font-black transition-colors"
                >
                  Отмена
                </button>
                <button 
                  type="submit"
                  disabled={isSyncing || !syncInput.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl text-xs uppercase tracking-widest font-black disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                >
                  {isSyncing ? 'Загрузка...' : 'Готово'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}