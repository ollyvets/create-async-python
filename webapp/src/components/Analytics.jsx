import React, { useState, useEffect } from 'react';
import { ChevronLeft, TrendingUp, TrendingDown, AlertCircle, BarChart2, ShieldCheck } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { useAnalytics } from '../hooks/useAnalytics';

const getCurrencySymbol = (curr) => {
  switch(curr) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'UAH': return '₴';
    case 'RUB': return '₽';
    case 'KZT': return '₸';
    default: return '$';
  }
};

const Analytics = ({ onBack }) => {
  const initData = window.Telegram?.WebApp?.initData || '';
  const { sessions, loading, error, selectedSession, setSelectedSession } = useAnalytics(initData);
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('analyticsIntroSeen')) setShowIntro(true);
  }, []);

  const closeIntro = () => {
    localStorage.setItem('analyticsIntroSeen', 'true');
    setShowIntro(false);
  };

  if (loading) return <div className="flex h-full items-center justify-center text-white font-bold tracking-widest uppercase">Loading Data...</div>;
  if (error) return <div className="flex h-full items-center justify-center text-red-500 font-bold uppercase">{error}</div>;

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  };

  const sym = selectedSession ? getCurrencySymbol(selectedSession.currency) : '$';
  const deviationCost = selectedSession ? (selectedSession.theo_end_balance - selectedSession.end_balance) : 0;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#151b2b] border border-gray-700 p-3 rounded-xl shadow-xl">
          <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Hand #{data.hand_num}</p>
          <div className="space-y-1">
            <p className="text-white text-xs">Real: <span className="font-bold">{sym}{data.balance.toFixed(2)}</span></p>
            <p className="text-blue-400 text-xs">Strategy: <span className="font-bold">{sym}{data.theo_balance.toFixed(2)}</span></p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full pb-4 animate-in fade-in duration-200 relative">
      {showIntro && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 z-[100]">
          <div className="bg-[#151b2b] border border-blue-500/30 p-6 rounded-3xl w-full max-w-sm text-center">
            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 mx-auto border border-blue-500/20">
              <ShieldCheck size={32} className="text-blue-400" />
            </div>
            <h3 className="text-xl font-black text-white mb-2">Strategy vs Emotion</h3>
            <p className="text-sm text-gray-400 mb-8 leading-relaxed">
              Compare your actual performance with the mathematical model. See exactly how much your emotional bets cost you.
            </p>
            <button onClick={closeIntro} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl uppercase tracking-wider">
              Get Started
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="bg-[#151b2b] p-2 rounded-xl border border-gray-800">
          <ChevronLeft size={24} className="text-gray-400" />
        </button>
        <div>
          <h2 className="text-lg font-black text-white">Performance Lab</h2>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">Strategy Comparison</p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="flex-grow flex flex-col items-center justify-center bg-[#151b2b] border border-gray-800 rounded-2xl p-6 text-center">
          <BarChart2 size={40} className="text-gray-600 mb-4" />
          <h3 className="text-xl font-black text-white mb-2">No Sessions Yet</h3>
          <p className="text-sm text-gray-500">Play at least one shoe to see your performance analysis.</p>
        </div>
      ) : (
        <>
          <div className="mb-6 flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
            {sessions.map((s) => {
              const sessionSym = getCurrencySymbol(s.currency);
              return (
                <button
                  key={s.session_id}
                  onClick={() => setSelectedSession(s)}
                  className={`min-w-[140px] p-4 rounded-2xl border text-left transition-all ${selectedSession?.session_id === s.session_id ? 'bg-blue-600/10 border-blue-500' : 'bg-[#151b2b] border-gray-800'}`}
                >
                  <div className="text-[10px] text-gray-500 font-bold mb-1">{formatDate(s.started_at)}</div>
                  <div className="text-lg font-black text-white">{sessionSym}{s.end_balance.toFixed(0)}</div>
                  <div className="text-[10px] text-gray-500 uppercase font-bold">Hands: {s.total_hands}</div>
                </button>
              )
            })}
          </div>

          {selectedSession && (
            <div className="flex flex-col gap-4 flex-grow">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#151b2b] border border-gray-800 p-4 rounded-2xl">
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Actual P&L</p>
                  <p className={`text-xl font-black ${selectedSession.end_balance >= selectedSession.start_balance ? 'text-green-400' : 'text-red-400'}`}>
                    {selectedSession.end_balance >= selectedSession.start_balance ? '+' : ''}{sym}{Math.abs(selectedSession.end_balance - selectedSession.start_balance).toFixed(2)}
                  </p>
                </div>
                <div className="bg-[#151b2b] border border-gray-800 p-4 rounded-2xl">
                  <p className="text-[10px] text-blue-400 uppercase font-bold mb-1">Cost of Thrill</p>
                  <p className={`text-xl font-black ${deviationCost > 0 ? 'text-orange-400' : 'text-gray-400'}`}>
                    {deviationCost > 0 ? '-' : ''}{sym}{Math.abs(deviationCost).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="bg-[#151b2b] border border-gray-800 rounded-3xl p-4 flex-grow min-h-[300px] flex flex-col">
                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-4">Balance Comparison</div>
                <div className="flex-grow w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedSession.chart_data}>
                      <XAxis dataKey="hand_num" hide />
                      <YAxis domain={['auto', 'auto']} hide />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" height={36}/>
                      <ReferenceLine y={selectedSession.start_balance} stroke="#374151" strokeDasharray="3 3" />
                      <Line 
                        name="Your Game"
                        type="monotone" 
                        dataKey="balance" 
                        stroke="#fff" 
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line 
                        name="Strategy"
                        type="monotone" 
                        dataKey="theo_balance" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Analytics;