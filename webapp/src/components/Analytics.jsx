import React, { useState, useEffect } from 'react';
import { ChevronLeft, TrendingUp, TrendingDown, AlertCircle, BarChart2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useAnalytics } from '../hooks/useAnalytics';

const Analytics = ({ onBack }) => {
  const initData = window.Telegram?.WebApp?.initData || '';
  const { sessions, loading, error, selectedSession, setSelectedSession } = useAnalytics(initData);
  
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    const hasSeenIntro = localStorage.getItem('analyticsIntroSeen');
    if (!hasSeenIntro) {
      setShowIntro(true);
    }
  }, []);

  const closeIntro = () => {
    localStorage.setItem('analyticsIntroSeen', 'true');
    setShowIntro(false);
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center text-white font-bold tracking-widest uppercase">Loading Data...</div>;
  }

  if (error) {
    return <div className="flex h-full items-center justify-center text-red-500 font-bold uppercase">{error}</div>;
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isProfit = data.profit >= 0;
      return (
        <div className="bg-[#151b2b] border border-gray-700 p-3 rounded-xl shadow-xl">
          <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Hand #{data.hand_num}</p>
          <p className="text-white font-black text-lg">Bank: ${data.balance.toFixed(2)}</p>
          <p className={`text-xs font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
            {isProfit ? '+' : ''}${data.profit.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full pb-4 animate-in fade-in duration-200 relative">
      
      {showIntro && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[#151b2b] border border-blue-500/30 p-6 rounded-3xl w-full max-w-sm text-center shadow-[0_0_30px_rgba(59,130,246,0.15)]">
            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 mx-auto border border-blue-500/20">
              <AlertCircle size={32} className="text-blue-400" />
            </div>
            <h3 className="text-xl font-black text-white mb-2">Analyze & Improve</h3>
            <p className="text-sm text-gray-400 mb-8 leading-relaxed">
              Review past sessions, track bankroll volatility, and find leaks in your strategy. Green indicates profit, red indicates loss.
            </p>
            <button
              onClick={closeIntro}
              className="w-full bg-blue-600 text-white font-black py-4 rounded-xl active:scale-95 transition-all uppercase tracking-wider"
            >
              I Understand
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="bg-[#151b2b] p-2 rounded-xl border border-gray-800 active:scale-95 transition-transform">
          <ChevronLeft size={24} className="text-gray-400" />
        </button>
        <div>
          <h2 className="text-lg font-black text-white">Session Analytics</h2>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">P&L History Tracker</p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="flex-grow flex flex-col items-center justify-center bg-[#151b2b] border border-gray-800 rounded-2xl p-6 text-center animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mb-6">
            <BarChart2 size={40} className="text-gray-600" />
          </div>
          <h3 className="text-xl font-black text-white mb-2">No Data Available</h3>
          <p className="text-sm text-gray-500 max-w-[250px] mx-auto leading-relaxed">
            You don't have any completed sessions yet. Start a new game and finish the shoe to generate your P&L analytics.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3">Recent Sessions</div>
            <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
              {sessions.map((session) => {
                const isWin = session.end_balance >= session.start_balance;
                const isSelected = selectedSession?.session_id === session.session_id;
                
                return (
                  <button
                    key={session.session_id}
                    onClick={() => setSelectedSession(session)}
                    className={`min-w-[140px] p-4 rounded-2xl border text-left transition-all flex-shrink-0 ${isSelected ? (isWin ? 'bg-green-500/10 border-green-500/50' : 'bg-red-500/10 border-red-500/50') : 'bg-[#151b2b] border-gray-800'}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] text-gray-500 font-bold">{formatDate(session.started_at)}</span>
                      {isWin ? <TrendingUp size={14} className="text-green-400" /> : <TrendingDown size={14} className="text-red-400" />}
                    </div>
                    <div className={`text-lg font-black ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                      ${session.end_balance.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase font-bold mt-1">
                      Hands: {session.total_hands}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedSession && selectedSession.chart_data.length > 0 && (
            <div className="bg-[#151b2b] border border-gray-800 rounded-2xl p-4 flex-grow flex flex-col min-h-[300px]">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Session P&L</div>
                  <div className={`text-2xl font-black ${selectedSession.end_balance >= selectedSession.start_balance ? 'text-green-400' : 'text-red-400'}`}>
                    {selectedSession.end_balance >= selectedSession.start_balance ? '+' : ''}
                    ${(selectedSession.end_balance - selectedSession.start_balance).toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Start Bank</div>
                  <div className="text-sm font-bold text-gray-400">${selectedSession.start_balance.toFixed(2)}</div>
                </div>
              </div>

              <div className="flex-grow w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedSession.chart_data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <XAxis dataKey="hand_num" hide />
                    <YAxis domain={['auto', 'auto']} hide />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#374151', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <ReferenceLine y={selectedSession.start_balance} stroke="#374151" strokeDasharray="3 3" />
                    <Line 
                      type="monotone" 
                      dataKey="balance" 
                      stroke={selectedSession.end_balance >= selectedSession.start_balance ? '#4ade80' : '#f87171'} 
                      strokeWidth={3}
                      dot={{ r: 3, fill: '#0a0f1c', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#fff', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Analytics;