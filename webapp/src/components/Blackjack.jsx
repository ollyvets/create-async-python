import React, { useState, useEffect } from 'react';
import { ChevronLeft, Flame, RotateCcw } from 'lucide-react';
import { getSavedState, getCurrencySymbol } from '../utils/helpers';

const TOTAL_DECKS = 8;
const TOTAL_CARDS = TOTAL_DECKS * 52;
const BASE_HOUSE_EDGE = -0.5;
const EDGE_PER_TRUE_COUNT = 0.5;

const Blackjack = ({ onBack }) => {
  const [runningCount, setRunningCount] = useState(() => getSavedState('bj_runningCount', 0));
  const [cardsDealt, setCardsDealt] = useState(() => getSavedState('bj_cardsDealt', 0));
  const [bjHistory, setBjHistory] = useState(() => getSavedState('bj_history', []));
  const [balance, setBalance] = useState(() => getSavedState('bj_balance', 1000));
  const [fireMode, setFireMode] = useState(() => getSavedState('bj_fireMode', false));
  const [currency, setCurrency] = useState(() => getSavedState('bj_currency', 'USD'));

  useEffect(() => {
    localStorage.setItem('bj_runningCount', JSON.stringify(runningCount));
    localStorage.setItem('bj_cardsDealt', JSON.stringify(cardsDealt));
    localStorage.setItem('bj_history', JSON.stringify(bjHistory));
    localStorage.setItem('bj_balance', JSON.stringify(balance));
    localStorage.setItem('bj_fireMode', JSON.stringify(fireMode));
    localStorage.setItem('bj_currency', currency);
  }, [runningCount, cardsDealt, bjHistory, balance, fireMode, currency]);

  const currSymbol = getCurrencySymbol(currency);

  const handleCardCount = (value) => { 
    setRunningCount(prev => prev + value); 
    setCardsDealt(prev => prev + 1); 
    setBjHistory(prev => [...prev, value]); 
  };

  const undoLastCard = () => { 
    if (bjHistory.length === 0) return; 
    const lastValue = bjHistory[bjHistory.length - 1]; 
    setRunningCount(prev => prev - lastValue); 
    setCardsDealt(prev => prev - 1); 
    setBjHistory(prev => prev.slice(0, -1)); 
  };

  const resetBjCounter = () => { 
    setRunningCount(0); 
    setCardsDealt(0); 
    setBjHistory([]); 
  };

  const cardsRemaining = TOTAL_CARDS - cardsDealt;
  const decksRemaining = Math.max(0.1, cardsRemaining / 52);
  const trueCount = parseFloat((runningCount / decksRemaining).toFixed(1));
  
  const deckPenetration = ((cardsDealt / TOTAL_CARDS) * 100).toFixed(1);
  const playerEdge = (BASE_HOUSE_EDGE + (trueCount * EDGE_PER_TRUE_COUNT)).toFixed(2);

  const calculateBet = () => {
    const currentBalance = Number(balance) || 0;
    const minBet = Math.max(1, Math.round(currentBalance * 0.002));

    if (playerEdge <= 0) {
      return {
        amount: fireMode ? 0 : minBet,
        message: 'SKIP OR MIN BET',
        color: 'text-gray-400',
        bg: 'bg-gray-800/50 border-gray-700'
      };
    } else {
      const edgeFraction = parseFloat(playerEdge) / 100;
      const betMultiplier = fireMode ? edgeFraction : (edgeFraction / 2); 
      let amount = Math.round(currentBalance * betMultiplier);
      
      amount = Math.max(minBet * 2, amount);

      return {
        amount: amount,
        message: fireMode ? '🔥 MAX ADVANTAGE PUSH!' : '🟢 ADVANTAGE ACTIVE',
        color: 'text-green-400',
        bg: 'bg-green-500/10 border-green-500/30'
      };
    }
  };

  const betInfo = calculateBet();

  return (
    <div className="animate-in slide-in-from-right-4 duration-300 flex flex-col h-full pb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="bg-[#151b2b] p-2 rounded-xl border border-gray-800 active:scale-95 transition-transform">
            <ChevronLeft size={24} className="text-gray-400" />
          </button>
          <div>
            <h2 className="text-lg font-black text-white">BJ Terminal</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Pro Analytics</p>
          </div>
        </div>
        <button onClick={resetBjCounter} className="text-[10px] text-red-400 font-bold uppercase border border-red-500/30 bg-red-500/10 px-3 py-2 rounded-lg active:scale-95 transition-transform">
          New Shoe
        </button>
      </div>
      
      <div className="bg-[#151b2b] border border-gray-800 rounded-2xl p-4 mb-4 flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Bankroll</div>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="bg-[#0a0f1c] text-gray-400 text-[10px] font-bold outline-none border border-gray-700 rounded px-1">
              <option value="USD">USD</option>
              <option value="UAH">UAH</option>
              <option value="RUB">RUB</option>
              <option value="KZT">KZT</option>
            </select>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-black">{currSymbol}</span>
            <input 
              type="number" 
              placeholder="0" 
              value={balance} 
              onChange={(e) => { const val = e.target.value; if (val === '') setBalance(''); else { const num = parseInt(val, 10); if (num >= 0) setBalance(num); } }} 
              className="w-full bg-[#0a0f1c] border border-gray-700 rounded-xl pl-7 pr-3 py-2 text-white font-black outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
            />
          </div>
        </div>
        <button onClick={() => setFireMode(!fireMode)} className={`h-[62px] w-[80px] flex flex-col items-center justify-center rounded-xl border mt-[18px] transition-all ${fireMode ? 'bg-orange-500/20 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.2)]' : 'bg-[#0a0f1c] border-gray-700 opacity-70'}`}>
          <Flame size={20} className={fireMode ? 'text-orange-500 mb-1' : 'text-gray-500 mb-1'} />
          <span className={`text-[10px] font-black uppercase ${fireMode ? 'text-orange-500' : 'text-gray-500'}`}>Fire</span>
        </button>
      </div>

      <div className={`border rounded-2xl p-4 mb-4 transition-colors duration-500 ${betInfo.bg}`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-1">Player Edge</div>
            <div className={`text-2xl font-black ${playerEdge > 0 ? 'text-green-400' : playerEdge < -0.5 ? 'text-red-400' : 'text-gray-300'}`}>
              {playerEdge > 0 ? '+' : ''}{playerEdge}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-1">Deck Pen.</div>
            <div className="text-2xl font-black text-white">{deckPenetration}%</div>
          </div>
        </div>

        <div className="w-full h-px bg-gray-700/50 mb-4"></div>

        <div className="flex justify-between items-center">
          <div className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">{betInfo.message}</div>
          <div className="flex items-end gap-1">
            <span className="text-xs text-gray-400 font-bold pb-1">Rec. Bet:</span>
            <span className={`text-3xl font-black ${betInfo.color}`}>{currSymbol}{betInfo.amount}</span>
          </div>
        </div>
      </div>

      <div className="bg-[#151b2b] border border-gray-800 rounded-2xl p-4 mb-4 flex justify-between items-center text-center">
        <div className="w-1/3">
          <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Run Count</div>
          <div className="text-xl font-black text-white">{runningCount > 0 ? `+${runningCount}` : runningCount}</div>
        </div>
        <div className="w-px h-8 bg-gray-800"></div>
        <div className="w-1/3">
          <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">True Count</div>
          <div className={`text-xl font-black transition-colors ${trueCount > 0 ? 'text-green-400' : 'text-white'}`}>{trueCount > 0 ? `+${trueCount}` : trueCount}</div>
        </div>
        <div className="w-px h-8 bg-gray-800"></div>
        <div className="w-1/3">
          <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Decks Left</div>
          <div className="text-lg font-bold text-gray-300">{decksRemaining.toFixed(1)}</div>
        </div>
      </div>

      <div className="flex justify-between items-end mb-2 px-1">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Card Input</div>
        <button onClick={undoLastCard} disabled={bjHistory.length === 0} className={`flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded transition-colors ${bjHistory.length > 0 ? 'text-blue-400 bg-blue-500/10' : 'text-gray-600'}`}>
          <RotateCcw size={12} /> Undo
        </button>
      </div>
      
      <div className="grid grid-cols-3 gap-2 flex-grow">
        <button onClick={() => handleCardCount(1)} className="bg-[#1a2333] border border-gray-700 rounded-2xl flex flex-col items-center justify-center py-4 active:bg-green-500/20 active:border-green-500/50 transition-colors">
          <span className="text-3xl font-black text-green-400 mb-1">+1</span>
          <span className="text-[10px] text-gray-500">2-6</span>
        </button>
        <button onClick={() => handleCardCount(0)} className="bg-[#1a2333] border border-gray-700 rounded-2xl flex flex-col items-center justify-center py-4 active:bg-gray-500/20 active:border-gray-500/50 transition-colors">
          <span className="text-3xl font-black text-gray-300 mb-1">0</span>
          <span className="text-[10px] text-gray-500">7-9</span>
        </button>
        <button onClick={() => handleCardCount(-1)} className="bg-[#1a2333] border border-gray-700 rounded-2xl flex flex-col items-center justify-center py-4 active:bg-red-500/20 active:border-red-500/50 transition-colors">
          <span className="text-3xl font-black text-red-400 mb-1">-1</span>
          <span className="text-[10px] text-gray-500">10-A</span>
        </button>
      </div>
    </div>
  );
};

export default Blackjack;