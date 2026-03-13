import React, { useState, useEffect } from 'react';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import { useBlackjack } from '../hooks/useBlackjack';

const Blackjack = ({ onBack }) => {
  const initData = window.Telegram?.WebApp?.initData || '';
  
  const {
    phase,
    setPhase,
    session,
    updateSessionConfig,
    startSession,
    hand,
    handleCardInput,
    updateCount,
    undoLastAction,
    submitResult,
    getRecommendedBet
  } = useBlackjack(initData);

  const [showEndModal, setShowEndModal] = useState(false);
  const [showBankruptModal, setShowBankruptModal] = useState(false);
  const [customBet, setCustomBet] = useState('');

  useEffect(() => {
    if (session.balance <= 0 && phase === 'count' && session.id) {
      setShowBankruptModal(true);
    }
  }, [session.balance, phase, session.id]);

  useEffect(() => {
    if (hand.playerCards.length === 0) {
      setCustomBet('');
    }
  }, [hand.playerCards.length]);

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

  const sym = getCurrencySymbol(session.currency);

  const handleDepositChange = (val) => {
    if (val === '') {
      updateSessionConfig('deposit', '');
      updateSessionConfig('minBet', '');
      updateSessionConfig('maxBet', '');
      return;
    }
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    
    const calculatedMin = Math.max(1, Math.round(num * 0.005));
    const calculatedMax = Math.min(Math.floor(num * 0.5), Math.max(calculatedMin, Math.round(num * 0.05)));
    
    updateSessionConfig('deposit', num);
    updateSessionConfig('minBet', calculatedMin);
    updateSessionConfig('maxBet', calculatedMax);
  };

  const isSetupValid = 
    session.deposit > 0 && 
    session.minBet > 0 && 
    session.maxBet > 0 && 
    session.minBet <= session.maxBet && 
    session.maxBet <= session.deposit * 0.5;

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const d = new Date(dateString);
    return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  };

  const recBet = getRecommendedBet();
  const finalBet = customBet !== '' ? parseFloat(customBet) : recBet;

  const handleResultSubmit = (outcome) => {
    submitResult(outcome, finalBet, recBet);
    setCustomBet('');
  };

  if (phase === 'loading') {
    return <div className="flex h-full items-center justify-center text-white font-bold tracking-widest uppercase">Initializing...</div>;
  }

  if (phase === 'restore') {
    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={onBack} className="bg-[#151b2b] p-2 rounded-xl border border-gray-800 active:scale-95 transition-transform">
            <ChevronLeft size={24} className="text-gray-400" />
          </button>
        </div>
        <div className="flex-grow flex flex-col justify-center items-center animate-in fade-in duration-300">
          <h2 className="text-2xl font-black text-white mb-6 text-center">Active Session Found</h2>
          <div className="w-full bg-[#151b2b] p-6 rounded-2xl border border-gray-800 text-center">
            <p className="text-gray-400 mb-6 text-sm">Do you want to restore the previous session?</p>
            <div className="bg-[#0a0f1c] p-5 rounded-xl border border-gray-700 mb-6">
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Started At</div>
              <div className="text-white font-bold mb-4">{formatDate(session.date)}</div>
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Current Balance</div>
              <div className="text-3xl font-black text-blue-400">{sym}{session.balance}</div>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={() => setPhase('count')} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl active:scale-95 transition-transform uppercase tracking-wider">
                Resume Session
              </button>
              <button onClick={() => setPhase('setup')} className="w-full bg-[#0a0f1c] border border-gray-700 text-gray-400 font-black py-4 rounded-xl active:scale-95 transition-transform uppercase tracking-wider">
                Discard & New Shoe
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'setup') {
    return (
      <div className="flex flex-col h-full pb-4 animate-in slide-in-from-right-4 duration-200">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="bg-[#151b2b] p-2 rounded-xl border border-gray-800 active:scale-95 transition-transform">
            <ChevronLeft size={24} className="text-gray-400" />
          </button>
          <div>
            <h2 className="text-lg font-black text-white">Setup Session</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Risk Management</p>
          </div>
        </div>

        <div className="w-full bg-[#151b2b] p-6 rounded-2xl border border-gray-800">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs text-gray-500 font-bold uppercase">Bankroll (Deposit)</label>
            <select value={session.currency} onChange={(e) => updateSessionConfig('currency', e.target.value)} className="bg-[#0a0f1c] text-gray-400 text-[10px] font-bold outline-none border border-gray-700 rounded px-1 py-0.5">
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="UAH">UAH</option>
              <option value="RUB">RUB</option>
              <option value="KZT">KZT</option>
            </select>
          </div>
          
          <div className="relative mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-black">{sym}</span>
            <input type="number" value={session.deposit} onChange={(e) => handleDepositChange(e.target.value)} placeholder="0" className="w-full bg-[#0a0f1c] border border-gray-700 rounded-xl pl-8 pr-3 py-3 text-white font-black outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Min Bet</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-black">{sym}</span>
                <input type="number" value={session.minBet} onChange={(e) => updateSessionConfig('minBet', e.target.value === '' ? '' : parseInt(e.target.value, 10))} placeholder="0" className="w-full bg-[#0a0f1c] border border-green-500/50 rounded-xl pl-8 pr-3 py-3 text-white font-black outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Max Bet</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-black">{sym}</span>
                <input type="number" value={session.maxBet} onChange={(e) => updateSessionConfig('maxBet', e.target.value === '' ? '' : parseInt(e.target.value, 10))} placeholder="0" className="w-full bg-[#0a0f1c] border border-red-500/50 rounded-xl pl-8 pr-3 py-3 text-white font-black outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
            </div>
          </div>

          <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Decks in Shoe</label>
          <select value={session.decks} onChange={(e) => updateSessionConfig('decks', Number(e.target.value))} className="w-full bg-[#0a0f1c] border border-gray-700 rounded-xl p-3 text-white font-bold outline-none mb-6">
            <option value={4}>4 Decks</option>
            <option value={6}>6 Decks</option>
            <option value={8}>8 Decks</option>
          </select>

          {!isSetupValid && session.deposit !== '' && (
            <div className="text-red-400 text-xs mb-4 text-center font-bold">
              {session.minBet > session.maxBet && <p>Min bet cannot be greater than Max bet.</p>}
              {session.maxBet > session.deposit * 0.5 && <p>Max bet cannot exceed 50% of the deposit.</p>}
            </div>
          )}

          <button 
            disabled={!isSetupValid}
            onClick={startSession} 
            className={`w-full text-white font-black py-4 rounded-xl transition-transform uppercase tracking-wider ${!isSetupValid ? 'bg-gray-700 cursor-not-allowed opacity-50' : 'bg-blue-600 active:scale-95'}`}
          >
            Agree & Start
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full pb-4 animate-in fade-in duration-200">
      
      {showBankruptModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-[#151b2b] border border-red-900 p-6 rounded-2xl w-full max-w-sm text-center animate-in zoom-in duration-200 shadow-[0_0_50px_rgba(220,38,38,0.3)]">
            <h3 className="text-3xl font-black text-red-500 mb-2 tracking-widest uppercase">Bankrupt</h3>
            <p className="text-sm text-gray-400 mb-8">You have lost your entire bankroll for this shoe. It's time to step away or start a new session.</p>
            <button onClick={() => { setShowBankruptModal(false); setPhase('setup'); }} className="w-full bg-red-600 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform uppercase tracking-wider shadow-lg shadow-red-900/50">
              Setup New Shoe
            </button>
          </div>
        </div>
      )}

      {showEndModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#151b2b] border border-gray-800 p-6 rounded-2xl w-full max-w-sm text-center animate-in zoom-in duration-200">
            <h3 className="text-xl font-black text-white mb-2">End Current Shoe?</h3>
            <p className="text-sm text-gray-400 mb-6">Are you sure? This will close your active session and return to setup.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowEndModal(false)} className="flex-1 bg-[#0a0f1c] border border-gray-700 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform">
                Cancel
              </button>
              <button onClick={() => { setShowEndModal(false); setPhase('setup'); }} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform">
                End Shoe
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="bg-[#151b2b] p-2 rounded-xl border border-gray-800 active:scale-95 transition-transform">
            <ChevronLeft size={24} className="text-gray-400" />
          </button>
          <div>
            <h2 className="text-lg font-black text-white">Bank: {sym}{session.balance}</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Running: {session.runningCount > 0 ? `+${session.runningCount}` : session.runningCount}</p>
          </div>
        </div>
        <button onClick={() => setShowEndModal(true)} className="text-[10px] text-red-400 font-bold uppercase border border-red-500/30 bg-red-500/10 px-3 py-2 rounded-lg active:scale-95 transition-transform">
          End Shoe
        </button>
      </div>

      <div className="bg-[#151b2b] border border-gray-800 rounded-2xl p-4 mb-4 flex-grow flex flex-col justify-center items-center text-center relative">
        {phase === 'action' && hand.recommendation ? (
          <div className="w-full mt-4 animate-in slide-in-from-bottom-4 duration-200">
            <div className="text-sm text-gray-400 font-bold uppercase mb-2">Mathematical Advantage</div>
            
            <div className={`font-black text-green-400 mb-6 ${hand.recommendation.action.length > 6 ? 'text-4xl' : 'text-6xl'}`}>
              {hand.recommendation.action}
            </div>
            
            <div className="flex justify-between w-full px-4 mb-8">
              <div className="text-center">
                <div className="text-[10px] text-gray-500 uppercase">Win</div>
                <div className="text-lg font-bold text-green-400">{hand.recommendation.win_prob}%</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-500 uppercase">Push</div>
                <div className="text-lg font-bold text-gray-400">{hand.recommendation.push_prob}%</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-500 uppercase">Loss</div>
                <div className="text-lg font-bold text-red-400">{hand.recommendation.loss_prob}%</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 w-full">
              <button onClick={() => handleResultSubmit('WIN')} className="flex flex-col items-center justify-center bg-green-500/20 border border-green-500 text-green-400 py-3 rounded-xl active:bg-green-500/30">
                <span className="font-bold text-sm">WIN</span>
                <span className="text-xs opacity-80">+{sym}{finalBet}</span>
              </button>
              <button onClick={() => handleResultSubmit('PUSH')} className="flex flex-col items-center justify-center bg-gray-500/20 border border-gray-500 text-gray-400 py-3 rounded-xl active:bg-gray-500/30">
                <span className="font-bold text-sm">PUSH</span>
                <span className="text-xs opacity-80">{sym}0</span>
              </button>
              <button onClick={() => handleResultSubmit('LOSS')} className="flex flex-col items-center justify-center bg-red-500/20 border border-red-500 text-red-400 py-3 rounded-xl active:bg-red-500/30">
                <span className="font-bold text-sm">LOSS</span>
                <span className="text-xs opacity-80">-{sym}{Math.min(finalBet, session.balance)}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full">
            {hand.playerCards.length === 0 && (
              <div className="bg-[#0a0f1c] border border-blue-500/30 rounded-xl p-4 mb-6 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                <div className="flex justify-between items-center mb-4">
                  <div className="text-left">
                    <div className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Recommended Bet</div>
                    <div className="text-xs text-gray-500 font-medium">Based on True Count</div>
                  </div>
                  <div className="text-2xl font-black text-white">{sym}{recBet}</div>
                </div>
                
                <div className="border-t border-gray-800 pt-4">
                  <label className="text-[10px] text-gray-500 font-bold uppercase block mb-2 text-left">Your Actual Bet (Optional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-black">{sym}</span>
                    <input 
                      type="number" 
                      value={customBet} 
                      onChange={(e) => setCustomBet(e.target.value)} 
                      placeholder={recBet.toString()} 
                      className="w-full bg-[#151b2b] border border-gray-700 rounded-xl pl-8 pr-3 py-3 text-white font-black outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between mb-6">
              <div className="w-1/2 border-r border-gray-800">
                <div className="text-[10px] text-gray-500 uppercase mb-2">Player Cards</div>
                <div className="text-2xl text-white font-bold h-8">{hand.playerCards.join(' ')} {hand.playerCards.length < 2 && '_'}</div>
              </div>
              <div className="w-1/2">
                <div className="text-[10px] text-gray-500 uppercase mb-2">Dealer Card</div>
                <div className="text-2xl text-white font-bold h-8">{hand.dealerCard || '_'}</div>
              </div>
            </div>

            <div className="flex justify-between items-center mb-2 mt-4">
              <div className="text-left text-[10px] text-gray-500 uppercase tracking-widest">Fast Count Input</div>
              {phase === 'count' && hand.actionStack.length > 0 && (
                <button onClick={undoLastAction} className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase border border-gray-700 bg-[#0a0f1c] px-2 py-1 rounded-md active:scale-95 transition-transform">
                  <RotateCcw size={12} /> Undo
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-2 mb-2">
              <button onClick={() => updateCount(1)} className="bg-[#1a2333] border border-gray-700 py-3 rounded-xl text-green-400 font-black text-xl active:bg-green-500/20 transition-colors">+1</button>
              <button onClick={() => updateCount(0)} className="bg-[#1a2333] border border-gray-700 py-3 rounded-xl text-gray-400 font-black text-xl active:bg-gray-500/20 transition-colors">0</button>
              <button onClick={() => updateCount(-1)} className="bg-[#1a2333] border border-gray-700 py-3 rounded-xl text-red-400 font-black text-xl active:bg-red-500/20 transition-colors">-1</button>
            </div>
            
            <div className="text-left text-[10px] text-gray-500 uppercase tracking-widest mb-2 mt-4">Select Cards</div>
            <div className="grid grid-cols-5 gap-1">
              {['2','3','4','5','6','7','8','9','10','J','Q','K','A'].map(card => (
                <button key={card} onClick={() => handleCardInput(card)} className="bg-blue-500/10 border border-blue-500/30 py-2 rounded text-blue-400 font-bold active:bg-blue-500/30 transition-colors">
                  {card}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Blackjack;