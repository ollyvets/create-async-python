import React, { useState, useEffect } from 'react';
import { ChevronLeft, RotateCcw } from 'lucide-react';

const Blackjack = ({ onBack }) => {
  const [sessionId, setSessionId] = useState(null);
  const [balance, setBalance] = useState(0);
  const [phase, setPhase] = useState('setup'); 
  const [decks, setDecks] = useState(6);
  const [betSize, setBetSize] = useState(10);
  
  const [runningCount, setRunningCount] = useState(0);
  const [cardsDealt, setCardsDealt] = useState(0);
  
  const [playerCards, setPlayerCards] = useState([]);
  const [dealerCard, setDealerCard] = useState(null);
  const [recommendation, setRecommendation] = useState(null);

  const initData = window.Telegram?.WebApp?.initData || '';

  const apiFetch = async (url, method, body) => {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-TG-Init-Data': initData
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('API Error');
    return res.json();
  };

  const startSession = async () => {
    try {
      const data = await apiFetch('/api/bj/session', 'POST', { total_decks: decks });
      setSessionId(data.session_id);
      setBalance(data.balance);
      setRunningCount(0);
      setCardsDealt(0);
      setPhase('count');
    } catch (e) {
      console.error(e);
    }
  };

  const updateCount = (val) => {
    setRunningCount(prev => prev + val);
    setCardsDealt(prev => prev + 1);
  };

  const handleCardInput = (cardStr) => {
    if (playerCards.length < 2) {
      setPlayerCards(prev => [...prev, cardStr]);
      updateCount(getCardCountValue(cardStr));
    } else if (!dealerCard) {
      setDealerCard(cardStr);
      updateCount(getCardCountValue(cardStr));
    }
  };

  const getCardCountValue = (card) => {
    const val = parseInt(card);
    if (['10', 'J', 'Q', 'K', 'A'].includes(card)) return -1;
    if (val >= 2 && val <= 6) return 1;
    return 0;
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
      setRecommendation(data.action);
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
        action_recommended: recommendation,
        profit: profit,
        new_running_count: runningCount,
        new_cards_dealt: cardsDealt
      });
      setBalance(data.new_balance);
      resetHand();
    } catch (e) {
      console.error(e);
    }
  };

  const resetHand = () => {
    setPlayerCards([]);
    setDealerCard(null);
    setRecommendation(null);
    setPhase('count');
  };

  if (phase === 'setup') {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4">
        <h2 className="text-2xl font-black text-white mb-6">New Shoe Setup</h2>
        <div className="w-full bg-[#151b2b] p-6 rounded-2xl border border-gray-800">
          <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Decks</label>
          <select value={decks} onChange={(e) => setDecks(Number(e.target.value))} className="w-full bg-[#0a0f1c] border border-gray-700 rounded-xl p-3 text-white mb-6">
            <option value={4}>4 Decks</option>
            <option value={6}>6 Decks</option>
            <option value={8}>8 Decks</option>
          </select>
          <button onClick={startSession} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl active:scale-95 transition-transform">
            Start Analytics
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full pb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="bg-[#151b2b] p-2 rounded-xl border border-gray-800 active:scale-95">
            <ChevronLeft size={24} className="text-gray-400" />
          </button>
          <div>
            <h2 className="text-lg font-black text-white">Bank: ${balance}</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Running: {runningCount > 0 ? `+${runningCount}` : runningCount}</p>
          </div>
        </div>
        <button onClick={() => setPhase('setup')} className="text-[10px] text-red-400 font-bold uppercase border border-red-500/30 bg-red-500/10 px-3 py-2 rounded-lg">
          End Shoe
        </button>
      </div>

      <div className="bg-[#151b2b] border border-gray-800 rounded-2xl p-4 mb-4 flex-grow flex flex-col justify-center items-center text-center">
        {phase === 'action' ? (
          <div>
            <div className="text-sm text-gray-400 font-bold uppercase mb-2">Recommendation</div>
            <div className="text-5xl font-black text-green-400 mb-8">{recommendation}</div>
            <div className="grid grid-cols-3 gap-2 w-full">
              <button onClick={() => submitResult(betSize)} className="bg-green-500/20 border border-green-500 text-green-400 py-3 rounded-xl font-bold">WIN</button>
              <button onClick={() => submitResult(0)} className="bg-gray-500/20 border border-gray-500 text-gray-400 py-3 rounded-xl font-bold">PUSH</button>
              <button onClick={() => submitResult(-betSize)} className="bg-red-500/20 border border-red-500 text-red-400 py-3 rounded-xl font-bold">LOSS</button>
            </div>
          </div>
        ) : (
          <div className="w-full">
            <div className="flex justify-between mb-6">
              <div className="w-1/2 border-r border-gray-800">
                <div className="text-[10px] text-gray-500 uppercase mb-2">Player Cards</div>
                <div className="text-2xl text-white font-bold">{playerCards.join(' ')} {playerCards.length < 2 && '_'}</div>
              </div>
              <div className="w-1/2">
                <div className="text-[10px] text-gray-500 uppercase mb-2">Dealer Card</div>
                <div className="text-2xl text-white font-bold">{dealerCard || '_'}</div>
              </div>
            </div>

            <div className="text-left text-[10px] text-gray-500 uppercase tracking-widest mb-2">Fast Count & Input</div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <button onClick={() => updateCount(1)} className="bg-[#1a2333] border border-gray-700 py-3 rounded-xl text-green-400 font-black text-xl">+1</button>
              <button onClick={() => updateCount(0)} className="bg-[#1a2333] border border-gray-700 py-3 rounded-xl text-gray-400 font-black text-xl">0</button>
              <button onClick={() => updateCount(-1)} className="bg-[#1a2333] border border-gray-700 py-3 rounded-xl text-red-400 font-black text-xl">-1</button>
            </div>
            
            <div className="text-left text-[10px] text-gray-500 uppercase tracking-widest mb-2 mt-4">Select Cards</div>
            <div className="grid grid-cols-5 gap-1">
              {['2','3','4','5','6','7','8','9','10','J','Q','K','A'].map(card => (
                <button key={card} onClick={() => handleCardInput(card)} className="bg-blue-500/10 border border-blue-500/30 py-2 rounded text-blue-400 font-bold">
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