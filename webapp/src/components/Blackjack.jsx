import React, { useState, useEffect } from 'react';
import { ChevronLeft, RotateCcw } from 'lucide-react';

const Blackjack = ({ onBack }) => {
  const [phase, setPhase] = useState('loading'); 
  const [sessionId, setSessionId] = useState(null);
  const [sessionDate, setSessionDate] = useState(null);
  
  // Модалки
  const [showEndModal, setShowEndModal] = useState(false);
  const [showBankruptModal, setShowBankruptModal] = useState(false);
  
  const [currency, setCurrency] = useState('USD');
  const [deposit, setDeposit] = useState(1000);
  const [minBet, setMinBet] = useState(5);
  const [maxBet, setMaxBet] = useState(50);
  const [decks, setDecks] = useState(6);
  const [balance, setBalance] = useState(0);
  
  const [runningCount, setRunningCount] = useState(0);
  const [cardsDealt, setCardsDealt] = useState(0);
  
  const [playerCards, setPlayerCards] = useState([]);
  const [dealerCard, setDealerCard] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [actionStack, setActionStack] = useState([]);

  const initData = window.Telegram?.WebApp?.initData || '';

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
  const sym = getCurrencySymbol(currency);

  const apiFetch = async (url, method, body = null) => {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-TG-Init-Data': initData
      }
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (!res.ok) throw new Error('API Error');
    return res.json();
  };

  useEffect(() => {
    checkActiveSession();
  }, []);

  const checkActiveSession = async () => {
    try {
      const data = await apiFetch('/api/bj/session/active', 'GET');
      if (data.has_active) {
        setSessionId(data.session_id);
        setBalance(data.balance);
        setRunningCount(data.running_count);
        setCardsDealt(data.cards_dealt);
        setSessionDate(data.started_at);
        setPhase('restore');
      } else {
        setPhase('setup');
      }
    } catch (e) {
      setPhase('setup');
    }
  };

  const handleDepositChange = (val) => {
    if (val === '') {
      setDeposit('');
      setMinBet('');
      setMaxBet('');
      return;
    }
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    
    setDeposit(num);
    const calculatedMin = Math.max(1, Math.round(num * 0.005));
    // Авторасчет: Макс ставка не больше 50% от депозита
    const calculatedMax = Math.min(Math.floor(num * 0.5), Math.max(calculatedMin, Math.round(num * 0.05)));
    
    setMinBet(calculatedMin);
    setMaxBet(calculatedMax);
  };

  const handleMinBetChange = (val) => {
    if (val === '') { setMinBet(''); return; }
    setMinBet(parseInt(val, 10));
  };

  const handleMaxBetChange = (val) => {
    if (val === '') { setMaxBet(''); return; }
    setMaxBet(parseInt(val, 10));
  };

  // Валидация настроек сессии
  const isSetupValid = 
    deposit > 0 && 
    minBet > 0 && 
    maxBet > 0 && 
    minBet <= maxBet && 
    maxBet <= deposit * 0.5;

  const startSession = async () => {
    if (!isSetupValid) return;
    try {
      const data = await apiFetch('/api/bj/session', 'POST', { total_decks: decks, deposit: deposit });
      setSessionId(data.session_id);
      setBalance(data.balance);
      setRunningCount(0);
      setCardsDealt(0);
      setActionStack([]);
      setPhase('count');
    } catch (e) {
      console.error(e);
    }
  };

  const getCardCountValue = (card) => {
    const val = parseInt(card);
    if (['10', 'J', 'Q', 'K', 'A'].includes(card)) return -1;
    if (val >= 2 && val <= 6) return 1;
    return 0;
  };

  const updateCount = (val, isCard = false, cardStr = null) => {
    setRunningCount(prev => prev + val);
    setCardsDealt(prev => prev + 1);
    setActionStack(prev => [...prev, { type: isCard ? 'card' : 'quick', val, cardStr }]);
  };

  const handleCardInput = (cardStr) => {
    if (playerCards.length < 2) {
      setPlayerCards(prev => [...prev, cardStr]);
      updateCount(getCardCountValue(cardStr), true, cardStr);
    } else if (!dealerCard) {
      setDealerCard(cardStr);
      updateCount(getCardCountValue(cardStr), true, cardStr);
    }
  };

  const undoLastAction = () => {
    if (actionStack.length === 0) return;
    const last = actionStack[actionStack.length - 1];
    
    setRunningCount(prev => prev - last.val);
    setCardsDealt(prev => prev - 1);
    
    if (last.type === 'card') {
      if (dealerCard) {
        setDealerCard(null);
      } else {
        setPlayerCards(prev => prev.slice(0, -1));
      }
    }
    setActionStack(prev => prev.slice(0, -1));
  };

  useEffect(() => {
    if (playerCards.length === 2 && dealerCard && phase === 'count') {
      analyzeHand();
    }
  }, [playerCards, dealerCard, phase]);

  const analyzeHand = async () => {
    try {
      const data = await apiFetch('/api/bj/analyze', 'POST', {
        session_id: sessionId,
        player_cards: playerCards,
        dealer_upcard: dealerCard
      });
      setRecommendation(data);
      setPhase('action');
    } catch (e) {
      console.error(e);
    }
  };

  const submitResult = async (profit) => {
    try {
      const data = await apiFetch('/api/bj/result', 'POST', {
        session_id: sessionId,
        player_cards: playerCards,
        dealer_upcard: dealerCard,
        action_taken: 'UNKNOWN',
        action_recommended: recommendation.action,
        profit: profit,
        new_running_count: runningCount,
        new_cards_dealt: cardsDealt
      });
      
      setBalance(data.new_balance);
      resetHand();

      // Проверка на банкротство
      if (data.new_balance <= 0) {
        setShowBankruptModal(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const resetHand = () => {
    setPlayerCards([]);
    setDealerCard(null);
    setRecommendation(null);
    setActionStack([]);
    setPhase('count');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const d = new Date(dateString);
    return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  };

  const getRecommendedBet = () => {
    const decksRemaining = Math.max(0.1, decks - (cardsDealt / 52));
    const trueCount = runningCount / decksRemaining;
    
    if (trueCount < 1.5) return minBet;
    
    let multiplier = 1;
    if (trueCount >= 1.5 && trueCount < 2.5) multiplier = 2;
    else if (trueCount >= 2.5 && trueCount < 3.5) multiplier = 4;
    else if (trueCount >= 3.5) multiplier = 8;
    
    const calcBet = minBet * multiplier;
    // Ставка не может превышать Max Bet и не может превышать остаток баланса
    return Math.min(maxBet, balance, Math.max(minBet, calcBet));
  };

  const recBet = getRecommendedBet();

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
              <div className="text-white font-bold mb-4">{formatDate(sessionDate)}</div>
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Current Balance</div>
              <div className="text-3xl font-black text-blue-400">{sym}{balance}</div>
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
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="bg-[#0a0f1c] text-gray-400 text-[10px] font-bold outline-none border border-gray-700 rounded px-1 py-0.5">
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="UAH">UAH</option>
              <option value="RUB">RUB</option>
              <option value="KZT">KZT</option>
            </select>
          </div>
          
          <div className="relative mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-black">{sym}</span>
            <input type="number" value={deposit} onChange={(e) => handleDepositChange(e.target.value)} placeholder="0" className="w-full bg-[#0a0f1c] border border-gray-700 rounded-xl pl-8 pr-3 py-3 text-white font-black outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Min Bet</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-black">{sym}</span>
                <input type="number" value={minBet} onChange={(e) => handleMinBetChange(e.target.value)} placeholder="0" className="w-full bg-[#0a0f1c] border border-green-500/50 rounded-xl pl-8 pr-3 py-3 text-white font-black outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Max Bet</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-black">{sym}</span>
                <input type="number" value={maxBet} onChange={(e) => handleMaxBetChange(e.target.value)} placeholder="0" className="w-full bg-[#0a0f1c] border border-red-500/50 rounded-xl pl-8 pr-3 py-3 text-white font-black outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
            </div>
          </div>

          <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Decks in Shoe</label>
          <select value={decks} onChange={(e) => setDecks(Number(e.target.value))} className="w-full bg-[#0a0f1c] border border-gray-700 rounded-xl p-3 text-white font-bold outline-none mb-6">
            <option value={4}>4 Decks</option>
            <option value={6}>6 Decks</option>
            <option value={8}>8 Decks</option>
          </select>

          {/* ВЫВОД ОШИБОК ВАЛИДАЦИИ */}
          {!isSetupValid && deposit !== '' && (
            <div className="text-red-400 text-xs mb-4 text-center font-bold">
              {minBet > maxBet && <p>Min bet cannot be greater than Max bet.</p>}
              {maxBet > deposit * 0.5 && <p>Max bet cannot exceed 50% of the deposit.</p>}
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
      
      {/* МОДАЛКА БАНКРОТСТВА */}
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

      {/* Модалка выхода из сессии */}
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
            <h2 className="text-lg font-black text-white">Bank: {sym}{balance}</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Running: {runningCount > 0 ? `+${runningCount}` : runningCount}</p>
          </div>
        </div>
        <button onClick={() => setShowEndModal(true)} className="text-[10px] text-red-400 font-bold uppercase border border-red-500/30 bg-red-500/10 px-3 py-2 rounded-lg active:scale-95 transition-transform">
          End Shoe
        </button>
      </div>

      <div className="bg-[#151b2b] border border-gray-800 rounded-2xl p-4 mb-4 flex-grow flex flex-col justify-center items-center text-center relative">
        {phase === 'count' && actionStack.length > 0 && (
          <button onClick={undoLastAction} className="absolute top-4 right-4 text-gray-400 bg-[#0a0f1c] p-2 rounded-lg border border-gray-700 active:scale-95 transition-transform">
            <RotateCcw size={16} />
          </button>
        )}

        {phase === 'action' && recommendation ? (
          <div className="w-full mt-4 animate-in slide-in-from-bottom-4 duration-200">
            <div className="text-sm text-gray-400 font-bold uppercase mb-2">Mathematical Advantage</div>
            
            <div className={`font-black text-green-400 mb-6 ${recommendation.action.length > 6 ? 'text-4xl' : 'text-6xl'}`}>
              {recommendation.action}
            </div>
            
            <div className="flex justify-between w-full px-4 mb-8">
              <div className="text-center">
                <div className="text-[10px] text-gray-500 uppercase">Win</div>
                <div className="text-lg font-bold text-green-400">{recommendation.win_prob}%</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-500 uppercase">Push</div>
                <div className="text-lg font-bold text-gray-400">{recommendation.push_prob}%</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-500 uppercase">Loss</div>
                <div className="text-lg font-bold text-red-400">{recommendation.loss_prob}%</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 w-full">
              <button onClick={() => submitResult(recBet)} className="flex flex-col items-center justify-center bg-green-500/20 border border-green-500 text-green-400 py-3 rounded-xl active:bg-green-500/30">
                <span className="font-bold text-sm">WIN</span>
                <span className="text-xs opacity-80">+{sym}{recBet}</span>
              </button>
              <button onClick={() => submitResult(0)} className="flex flex-col items-center justify-center bg-gray-500/20 border border-gray-500 text-gray-400 py-3 rounded-xl active:bg-gray-500/30">
                <span className="font-bold text-sm">PUSH</span>
                <span className="text-xs opacity-80">{sym}0</span>
              </button>
              <button onClick={() => submitResult(-Math.min(recBet, balance))} className="flex flex-col items-center justify-center bg-red-500/20 border border-red-500 text-red-400 py-3 rounded-xl active:bg-red-500/30">
                <span className="font-bold text-sm">LOSS</span>
                <span className="text-xs opacity-80">-{sym}{Math.min(recBet, balance)}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full">
            {playerCards.length === 0 && (
              <div className="bg-[#0a0f1c] border border-blue-500/30 rounded-xl p-3 mb-6 flex justify-between items-center shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                <div className="text-left">
                  <div className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Next Optimal Bet</div>
                  <div className="text-xs text-gray-500 font-medium">Based on True Count</div>
                </div>
                <div className="text-2xl font-black text-white">{sym}{recBet}</div>
              </div>
            )}

            <div className="flex justify-between mb-6">
              <div className="w-1/2 border-r border-gray-800">
                <div className="text-[10px] text-gray-500 uppercase mb-2">Player Cards</div>
                <div className="text-2xl text-white font-bold h-8">{playerCards.join(' ')} {playerCards.length < 2 && '_'}</div>
              </div>
              <div className="w-1/2">
                <div className="text-[10px] text-gray-500 uppercase mb-2">Dealer Card</div>
                <div className="text-2xl text-white font-bold h-8">{dealerCard || '_'}</div>
              </div>
            </div>

            <div className="text-left text-[10px] text-gray-500 uppercase tracking-widest mb-2">Fast Count Input</div>
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