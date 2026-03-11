import React, { useState, useEffect } from 'react';
import { Shield, Zap, Activity, Gift, X, Target } from 'lucide-react';
import Blackjack from './components/Blackjack';
// import Roulette from './components/Roulette';
// import Crash from './components/Crash'; 

const App = () => {
  // Для тестов ставим isVip сразу в true
  const [isVip, setIsVip] = useState(true); 
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('home');
  const [showCrashPopup, setShowCrashPopup] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      // --- ВРЕМЕННО ЗАКОММЕНТИРОВАНО ДЛЯ ТЕСТОВ ---
      /*
      if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        
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
      */
      
      // ИМИТАЦИЯ ЗАГРУЗКИ ДЛЯ ТЕСТОВ (чтобы видеть лоадер, если нужно)
      setTimeout(() => {
        setIsVip(true); // Принудительно даем доступ
        setLoading(false);
      }, 500);
    };
    checkAccess();
  }, []);

  if (loading) {
      return (
          <div className="h-screen bg-[#0a0f1c] flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
      );
  }

  // --- ВРЕМЕННО ОТКЛЮЧЕН ЭКРАН PAYWALL ---
  /*
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
  */

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
        {currentView === 'blackjack' && <Blackjack onBack={() => setCurrentView('home')} />}
        {/* Раскомментируй это, когда создашь файл Roulette.jsx */}
        {/* {currentView === 'roulette' && <Roulette onBack={() => setCurrentView('home')} />} */}
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