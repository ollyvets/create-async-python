import React, { useState, useEffect } from 'react';
import { Shield, Zap, TrendingUp, Activity, ChevronLeft, Gift, X, RotateCcw, Flame, Info, Target } from 'lucide-react';

// Хелпер для памяти
const getSavedState = (key, defaultValue) => {
  const saved = localStorage.getItem(key);
  if (saved !== null) {
    try { return JSON.parse(saved); } catch (e) { return saved; }
  }
  return defaultValue;
};

// --- ДАННЫЕ РУЛЕТКИ ---
const ROULETTE_NUMBERS = Array.from({ length: 37 }, (_, i) => i);
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

const getNumberColor = (num) => {
  if (num === 0) return 'green';
  if (RED_NUMBERS.includes(num)) return 'red';
  return 'black';
};

const App = () => {
  const [isVip, setIsVip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('home');
  const [showCrashPopup, setShowCrashPopup] = useState(false);

  // --- Стейты Блэкджека ---
  const [runningCount, setRunningCount] = useState(() => getSavedState('bj_runningCount', 0));
  const [cardsDealt, setCardsDealt] = useState(() => getSavedState('bj_cardsDealt', 0));
  const [bjHistory, setBjHistory] = useState(() => getSavedState('bj_history', []));
  const [balance, setBalance] = useState(() => getSavedState('bj_balance', 1000));
  const [fireMode, setFireMode] = useState(() => getSavedState('bj_fireMode', false));
  const [currency, setCurrency] = useState(() => getSavedState('bj_currency', 'USD'));

  // --- Стейты Рулетки ---
  const [rlHistory, setRlHistory] = useState(() => getSavedState('rl_history', []));

  useEffect(() => {
    localStorage.setItem('bj_runningCount', JSON.stringify(runningCount));
    localStorage.setItem('bj_cardsDealt', JSON.stringify(cardsDealt));
    localStorage.setItem('bj_history', JSON.stringify(bjHistory));
    localStorage.setItem('bj_balance', JSON.stringify(balance));
    localStorage.setItem('bj_fireMode', JSON.stringify(fireMode));
    localStorage.setItem('bj_currency', currency);
    localStorage.setItem('rl_history', JSON.stringify(rlHistory));
  }, [runningCount, cardsDealt, bjHistory, balance, fireMode, currency, rlHistory]);

  useEffect(() => {
    const checkAccess = async () => {
      if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        
        // Если зашли из браузера без данных телеги - сразу закрываем доступ
        if (!tg.initData) {
            setIsVip(false);
            setLoading(false);
            return;
        }

        try {
          const response = await fetch('/api/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: tg.initData })
          });
          
          if (response.ok) {
            const data = await response.json();
            setIsVip(data.is_vip);
          } else {
            setIsVip(false);
          }
        } catch (e) {
          console.error("Auth Error:", e);
          setIsVip(false);
        } finally {
          setLoading(false);
        }
      } else {
        setIsVip(false);
        setLoading(false);
      }
    };
    checkAccess();
  }, []);

  const getCurrencySymbol = (curr) => {
    switch(curr) { case 'USD': return '$'; case 'UAH': return '₴'; case 'RUB': return '₽'; case 'KZT': return '₸'; default: return '$'; }
  };
  const currSymbol = getCurrencySymbol(currency);

  const handleCardCount = (value) => { setRunningCount(prev => prev + value); setCardsDealt(prev => prev + 1); setBjHistory(prev => [...prev, value]); };
  const undoLastCard = () => { if (bjHistory.length === 0) return; const lastValue = bjHistory[bjHistory.length - 1]; setRunningCount(prev => prev - lastValue); setCardsDealt(prev => prev - 1); setBjHistory(prev => prev.slice(0, -1)); };
  const resetBjCounter = () => { setRunningCount(0); setCardsDealt(0); setBjHistory([]); };

  const decksRemaining = Math.max(1, ((8 * 52) - cardsDealt) / 52).toFixed(1);
  const trueCount = parseFloat((runningCount / decksRemaining).toFixed(1));

  const getBetAdvice = () => {
    let colorClass, bgClass, message, betPct;
    if (trueCount < 1) { colorClass = 'text-red-400'; bgClass = 'bg-red-500/10 border-red-500/30'; message = '🛑 SKIP OR MIN BET'; betPct = fireMode ? 0 : 0.005; } 
    else if (trueCount >= 1 && trueCount < 2) { colorClass = 'text-orange-400'; bgClass = 'bg-orange-500/10 border-orange-500/30'; message = '⚠️ STANDARD PLAY'; betPct = fireMode ? 0.05 : 0.015; } 
    else { colorClass = 'text-green-400'; bgClass = 'bg-green-500/10 border-green-500/30'; message = '🔥 ADVANTAGE! INCREASE BET'; betPct = fireMode ? 0.15 : 0.05; }
    const currentBalance = Number(balance) || 0; 
    let calculatedBet = Math.round(currentBalance * betPct);
    if (trueCount < 1 && fireMode) calculatedBet = 0;
    else if (calculatedBet === 0 && currentBalance > 0 && betPct > 0) calculatedBet = 1;
    return { colorClass, bgClass, message, bet: calculatedBet };
  };

  const addRouletteNumber = (num) => setRlHistory(prev => [num, ...prev].slice(0, 50));
  const undoRoulette = () => setRlHistory(prev => prev.slice(1));
  const resetRoulette = () => setRlHistory([]);

  const getRouletteAdvice = () => {
    if (rlHistory.length < 3) return { message: '⏳ LOG AT LEAST 3 NUMBERS', sub: 'Awaiting data for analysis...', color: 'text-gray-400', border: 'border-gray-700' };
    const last5 = rlHistory.slice(0, 5);
    const last12 = rlHistory.slice(0, 12);
    const recentColors = last5.map(getNumberColor).filter(c => c !== 'green');
    if (recentColors.length >= 4 && recentColors.every(c => c === recentColors[0])) {
      const oppositeColor = recentColors[0] === 'red' ? 'BLACK' : 'RED';
      return { message: `🔥 COLOR ANOMALY! BET ON ${oppositeColor}`, sub: `${recentColors[0] === 'red' ? 'Red' : 'Black'} hit ${recentColors.length} times in a row.`, color: 'text-orange-400', border: 'border-orange-500/50', pulse: true };
    }
    const dozensHit = last12.slice(0, 8).map(n => n === 0 ? 0 : Math.ceil(n / 12));
    if (!dozensHit.includes(1) && rlHistory.length >= 8) return { message: '🎯 ENTER 1ST DOZEN', sub: 'Numbers 1-12 haven\'t hit in 8 spins!', color: 'text-green-400', border: 'border-green-500/50' };
    if (!dozensHit.includes(2) && rlHistory.length >= 8) return { message: '🎯 ENTER 2ND DOZEN', sub: 'Numbers 13-24 haven\'t hit in 8 spins!', color: 'text-green-400', border: 'border-green-500/50' };
    if (!dozensHit.includes(3) && rlHistory.length >= 8) return { message: '🎯 ENTER 3RD DOZEN', sub: 'Numbers 25-36 haven\'t hit in 8 spins!', color: 'text-green-400', border: 'border-green-500/50' };
    const evens = last5.filter(n => n !== 0).map(n => n % 2 === 0);
    if (evens.length >= 4 && evens.every(e => e === true)) return { message: '⚡ BET ON ODD', sub: 'Even numbers hit too many times in a row.', color: 'text-cyan-400', border: 'border-cyan-500/50' };
    if (evens.length >= 4 && evens.every(e => e === false)) return { message: '⚡ BET ON EVEN', sub: 'Odd numbers hit too many times in a row.', color: 'text-cyan-400', border: 'border-cyan-500/50' };
    return { message: '✅ NORMAL VARIANCE', sub: 'No anomalies detected. Wait or play small.', color: 'text-blue-400', border: 'border-blue-500/30' };
  };

  const getNumberTemperature = (num) => {
    if (rlHistory.length < 10) return '';
    const hits = rlHistory.filter(n => n === num).length;
    if (hits >= 3) return 'ring-2 ring-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)] scale-110 z-10'; 
    if (hits === 0 && rlHistory.length > 20) return 'opacity-40 ring-1 ring-blue-500/50'; 
    return '';
  };

  // ЭКРАН ЗАГРУЗКИ
  if (loading) {
      return (
          <div className="h-screen bg-[#0a0f1c] flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
      );
  }

  // ЭКРАН: ДОСТУП ЗАКРЫТ (PAYWALL)
  if (!isVip) {
    return (
      <div className="h-screen bg-[#0a0f1c] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.15)]">
           <Shield size={40} className="text-red-500" />
        </div>
        <h2 className="text-3xl font-black text-white mb-3">ACCESS DENIED</h2>
        <p className="text-gray-400 mb-8 max-w-xs mx-auto text-sm leading-relaxed">
          Your VIP subscription or trial period has expired. Please renew your access in the Telegram bot to continue using the analyzer.
        </p>
        <button 
          onClick={() => window.Telegram?.WebApp?.close()} 
          className="bg-blue-600 hover:bg-blue-500 text-white font-black py-4 px-12 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(37,99,235,0.3)]"
        >
          Return to Bot
        </button>
      </div>
    );
  }

  // --- ЭКРАН: ГЛАВНОЕ МЕНЮ ---
  const renderHome = () => (
    <div className="animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/30 rounded-2xl p-4 mb-6 relative overflow-hidden flex items-center justify-between">
        <div className="absolute -right-4 -top-4 text-blue-500/10 rotate-12"><Gift size={100} /></div>
        <div className="relative z-10">
          <div className="text-[10px] text-blue-300 font-bold uppercase tracking-widest mb-1">VIP Exclusive Bonus</div>
          <div className="text-lg font-black text-white">PROMO: <span className="text-yellow-400">YOURCODE500</span></div>
          <div className="text-xs text-gray-400 mt-1">+500% to your first deposit</div>
        </div>
        <button onClick={() => { navigator.clipboard.writeText('YOURCODE500'); if (window.Telegram?.WebApp) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success'); }} className="relative z-10 bg-blue-600 active:bg-blue-400 text-white text-[10px] font-black py-2.5 px-4 rounded-xl transition-all active:scale-90">COPY</button>
      </div>
      <div className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Select Engine</div>
      <div className="space-y-4">
        <button onClick={() => setCurrentView('blackjack')} className="w-full bg-[#151b2b] border border-gray-800 hover:border-blue-500/50 rounded-2xl p-5 flex items-center gap-4 active:scale-95 transition-all">
          <div className="bg-blue-500/10 p-3 rounded-xl"><Zap size={28} className="text-blue-400" /></div>
          <div className="text-left"><div className="text-lg font-black text-white">BlackJack Counter</div><div className="text-xs text-gray-500">Hi-Lo System & Money Management</div></div>
        </button>
        <button onClick={() => setCurrentView('roulette')} className="w-full bg-[#151b2b] border border-gray-800 hover:border-purple-500/50 rounded-2xl p-5 flex items-center gap-4 active:scale-95 transition-all">
          <div className="bg-purple-500/10 p-3 rounded-xl"><Target size={28} className="text-purple-400" /></div>
          <div className="text-left"><div className="text-lg font-black text-white">Roulette Predictor</div><div className="text-xs text-gray-500">Anomaly & Heatmap Detection</div></div>
        </button>
        <button onClick={() => setShowCrashPopup(true)} className="w-full bg-[#151b2b] border border-gray-800 hover:border-cyan-500/50 rounded-2xl p-5 flex items-center gap-4 active:scale-95 transition-all relative overflow-hidden">
          <div className="bg-cyan-500/10 p-3 rounded-xl"><Activity size={28} className="text-cyan-400" /></div>
          <div className="text-left"><div className="text-lg font-black text-white">Crash X-Engine</div><div className="text-xs text-gray-500">Aviator & Lucky Jet</div></div>
          <div className="absolute top-3 right-3 bg-red-500/20 text-red-400 text-[9px] px-2 py-1 rounded-full font-bold uppercase tracking-widest border border-red-500/20">BETA</div>
        </button>
      </div>
    </div>
  );

  // --- ЭКРАН: БЛЭКДЖЕК ---
  const renderBlackjack = () => {
    const advice = getBetAdvice();
    return (
      <div className="animate-in slide-in-from-right-4 duration-300 flex flex-col h-full pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentView('home')} className="bg-[#151b2b] p-2 rounded-xl border border-gray-800 active:scale-95"><ChevronLeft size={24} className="text-gray-400" /></button>
            <div><h2 className="text-lg font-black text-white">BJ Counter</h2><p className="text-[10px] text-gray-500 uppercase">Hi-Lo System</p></div>
          </div>
          <button onClick={resetBjCounter} className="text-[10px] text-red-400 font-bold uppercase border border-red-500/30 bg-red-500/10 px-3 py-2 rounded-lg active:scale-95">New Shoe</button>
        </div>
        
        <div className="bg-[#151b2b] border border-gray-800 rounded-2xl p-4 mb-4 flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Bankroll</div>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="bg-[#0a0f1c] text-gray-400 text-[10px] font-bold outline-none border border-gray-700 rounded px-1"><option value="USD">USD</option><option value="UAH">UAH</option><option value="RUB">RUB</option><option value="KZT">KZT</option></select>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-black">{currSymbol}</span>
              <input type="number" placeholder="0" value={balance} onChange={(e) => { const val = e.target.value; if (val === '') setBalance(''); else { const num = parseInt(val, 10); if (num >= 0) setBalance(num); } }} className="w-full bg-[#0a0f1c] border border-gray-700 rounded-xl pl-7 pr-3 py-2 text-white font-black outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
          </div>
          <button onClick={() => setFireMode(!fireMode)} className={`h-[62px] w-[80px] flex flex-col items-center justify-center rounded-xl border mt-[18px] ${fireMode ? 'bg-orange-500/20 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.2)]' : 'bg-[#0a0f1c] border-gray-700 opacity-70'}`}><Flame size={20} className={fireMode ? 'text-orange-500 mb-1' : 'text-gray-500 mb-1'} /><span className={`text-[10px] font-black uppercase ${fireMode ? 'text-orange-500' : 'text-gray-500'}`}>Fire</span></button>
        </div>

        <div className={`border rounded-2xl p-5 mb-4 text-center transition-colors duration-500 ${advice.bgClass}`}>
          <div className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-1">{advice.message}</div>
          <div className="flex justify-center items-end gap-1"><span className="text-sm text-gray-400 font-bold pb-1">Recommended Bet:</span><span className={`text-4xl font-black ${advice.colorClass}`}>{currSymbol}{advice.bet}</span></div>
        </div>

        <div className="bg-[#151b2b] border border-gray-800 rounded-2xl p-4 mb-4 flex justify-between items-center text-center">
          <div className="w-1/3"><div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Run Count</div><div className="text-2xl font-black text-white">{runningCount > 0 ? `+${runningCount}` : runningCount}</div></div><div className="w-px h-10 bg-gray-800"></div>
          <div className="w-1/3"><div className="text-[10px] text-gray-500 font-bold uppercase mb-1">True Count</div><div className={`text-2xl font-black ${trueCount >= 2 ? 'text-green-400' : 'text-white'}`}>{trueCount > 0 ? `+${trueCount}` : trueCount}</div></div><div className="w-px h-10 bg-gray-800"></div>
          <div className="w-1/3"><div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Decks Left</div><div className="text-xl font-bold text-gray-300">{decksRemaining}</div></div>
        </div>

        <div className="flex justify-between items-end mb-2 px-1">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Log Dealt Cards</div>
          <button onClick={undoLastCard} disabled={bjHistory.length === 0} className={`flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded ${bjHistory.length > 0 ? 'text-blue-400 bg-blue-500/10' : 'text-gray-600'}`}><RotateCcw size={12} /> Undo</button>
        </div>
        <div className="grid grid-cols-3 gap-2 flex-grow">
          <button onClick={() => handleCardCount(1)} className="bg-[#1a2333] border border-gray-700 rounded-2xl flex flex-col items-center justify-center py-4 active:bg-green-500/20 active:border-green-500/50"><span className="text-3xl font-black text-green-400 mb-1">+1</span><span className="text-[10px] text-gray-500">2-6</span></button>
          <button onClick={() => handleCardCount(0)} className="bg-[#1a2333] border border-gray-700 rounded-2xl flex flex-col items-center justify-center py-4 active:bg-gray-500/20 active:border-gray-500/50"><span className="text-3xl font-black text-gray-300 mb-1">0</span><span className="text-[10px] text-gray-500">7-9</span></button>
          <button onClick={() => handleCardCount(-1)} className="bg-[#1a2333] border border-gray-700 rounded-2xl flex flex-col items-center justify-center py-4 active:bg-red-500/20 active:border-red-500/50"><span className="text-3xl font-black text-red-400 mb-1">-1</span><span className="text-[10px] text-gray-500">10-A</span></button>
        </div>
      </div>
    );
  };

  // --- ЭКРАН: РУЛЕТКА ---
  const renderRoulette = () => {
    const rlAdvice = getRouletteAdvice();
    return (
      <div className="animate-in slide-in-from-right-4 duration-300 flex flex-col h-full pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentView('home')} className="bg-[#151b2b] p-2 rounded-xl border border-gray-800 active:scale-95"><ChevronLeft size={24} className="text-gray-400" /></button>
            <div><h2 className="text-lg font-black text-white">Roulette AI</h2><p className="text-[10px] text-gray-500 uppercase tracking-widest">Anomaly Detector</p></div>
          </div>
          <button onClick={resetRoulette} className="text-[10px] text-red-400 font-bold uppercase border border-red-500/30 bg-red-500/10 px-3 py-2 rounded-lg active:scale-95">Clear Data</button>
        </div>

        <div className={`bg-[#151b2b] border rounded-2xl p-5 mb-4 text-center transition-all duration-500 ${rlAdvice.border} ${rlAdvice.pulse ? 'animate-pulse shadow-[0_0_20px_rgba(249,115,22,0.15)]' : ''}`}>
          <div className={`text-lg font-black mb-1 ${rlAdvice.color}`}>{rlAdvice.message}</div>
          <div className="text-xs text-gray-400 font-medium">{rlAdvice.sub}</div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-end mb-2 px-1">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">History (Last {rlHistory.length})</div>
            <button onClick={undoRoulette} disabled={rlHistory.length === 0} className={`flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded ${rlHistory.length > 0 ? 'text-blue-400 bg-blue-500/10' : 'text-gray-600'}`}><RotateCcw size={12} /> Undo</button>
          </div>
          <div className="bg-[#151b2b] border border-gray-800 rounded-xl p-3 flex gap-2 overflow-x-auto snap-x hide-scrollbar h-[60px] items-center">
            {rlHistory.length === 0 ? <div className="text-xs text-gray-500 mx-auto italic">Tap a number below to start...</div> :
             rlHistory.map((num, i) => (
              <div key={i} className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black border-2 snap-center ${getNumberColor(num) === 'red' ? 'bg-red-500/20 text-red-500 border-red-500/50' : getNumberColor(num) === 'black' ? 'bg-gray-800 text-white border-gray-600' : 'bg-green-500/20 text-green-500 border-green-500/50'} ${i === 0 ? 'scale-110 shadow-lg' : 'opacity-70'}`}>
                {num}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-grow flex flex-col mt-2 overflow-y-auto hide-scrollbar pb-6">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1 text-center mb-2">Tap winning numbers</div>
          <button onClick={() => addRouletteNumber(0)} className={`w-full py-2 mb-2 rounded-xl font-black text-lg border transition-all active:scale-95 bg-green-500/10 text-green-500 border-green-500/30 ${getNumberTemperature(0)}`}>0</button>
          {[ { start: 1, end: 12, label: "1st Dozen" }, { start: 13, end: 24, label: "2nd Dozen" }, { start: 25, end: 36, label: "3rd Dozen" } ].map((dozen, index) => (
            <div key={index} className="bg-[#151b2b] p-2.5 rounded-xl border border-gray-800 mb-2">
              <div className="text-[9px] text-gray-500 font-bold uppercase mb-2 text-center tracking-widest">{dozen.label}</div>
              <div className="grid grid-cols-6 gap-1.5">
                {ROULETTE_NUMBERS.slice(dozen.start, dozen.end + 1).map(num => {
                  const isRed = RED_NUMBERS.includes(num);
                  const tempClass = getNumberTemperature(num);
                  return (
                    <button key={num} onClick={() => addRouletteNumber(num)} className={`relative h-10 rounded-lg flex items-center justify-center text-sm font-black border transition-all active:scale-90 ${isRed ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-[#1a2333] text-gray-200 border-gray-700'} ${tempClass}`}>
                      {num}
                      {tempClass.includes('orange') && <Flame size={10} className="absolute -top-1 -right-1 text-orange-500 drop-shadow-md" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen bg-[#0a0f1c] text-white font-sans overflow-hidden selection:bg-blue-500/30 flex flex-col">
      <header className="flex justify-between items-center p-4 border-b border-gray-800/50 bg-[#0a0f1c] z-40">
        <div className="flex items-center gap-3">
          <div className="relative"><div className="w-2 h-2 bg-blue-500 rounded-full"></div><div className="w-2 h-2 bg-blue-500 rounded-full absolute top-0 left-0 animate-ping opacity-75"></div></div>
          <span className="font-black italic text-lg tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">ANALYTIX</span>
        </div>
        <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full"><Shield size={10} className="text-blue-400" /><span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">VIP Active</span></div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 hide-scrollbar">
        {currentView === 'home' && renderHome()}
        {currentView === 'blackjack' && renderBlackjack()}
        {currentView === 'roulette' && renderRoulette()}
      </main>
      
      {showCrashPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#151b2b] border border-gray-800 rounded-3xl w-full max-w-sm p-6 relative shadow-2xl">
            <button onClick={() => setShowCrashPopup(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={24} /></button>
            <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mb-4 mx-auto border border-cyan-500/20"><Activity size={32} className="text-cyan-400" /></div>
            <h3 className="text-2xl font-black text-center text-white mb-2">COMING SOON</h3>
            <p className="text-center text-gray-400 text-sm mb-6">The Crash X-Engine is currently undergoing neural network training to maximize prediction accuracy.</p>
            <button onClick={() => setShowCrashPopup(false)} className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl uppercase tracking-widest text-xs">Got it</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;