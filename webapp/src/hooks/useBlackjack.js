import { useState, useEffect } from 'react';

export const useBlackjack = (initData) => {
  const [phase, setPhase] = useState('loading');
  const [session, setSession] = useState({ id: null, date: null, decks: 6, currency: 'USD', deposit: 1000, minBet: 5, maxBet: 50, balance: 0, runningCount: 0, cardsDealt: 0 });
  const [hand, setHand] = useState({ playerCards: [], dealerCard: null, recommendation: null, actionStack: [] });

  const apiFetch = async (url, method, body = null) => {
    const options = { method, headers: { 'Content-Type': 'application/json', 'X-TG-Init-Data': initData } };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (!res.ok) throw new Error('API Error');
    return res.json();
  };

  useEffect(() => { checkActiveSession(); }, []);

  const checkActiveSession = async () => {
    try {
      const data = await apiFetch('/api/bj/session/active', 'GET');
      if (data.has_active) {
        setSession(prev => ({ ...prev, id: data.session_id, balance: data.balance, runningCount: data.running_count, cardsDealt: data.cards_dealt, date: data.started_at }));
        setPhase('restore');
      } else { setPhase('setup'); }
    } catch (e) { setPhase('setup'); }
  };

  const updateSessionConfig = (key, value) => setSession(prev => ({ ...prev, [key]: value }));

  const startSession = async () => {
    try {
      const data = await apiFetch('/api/bj/session', 'POST', { 
        total_decks: session.decks, 
        deposit: session.deposit,
        currency: session.currency 
      });
      setSession(prev => ({ ...prev, id: data.session_id, balance: data.balance, runningCount: 0, cardsDealt: 0 }));
      setHand({ playerCards: [], dealerCard: null, recommendation: null, actionStack: [] });
      setPhase('count');
    } catch (e) { console.error(e); }
  };

  const getCardCountValue = (card) => {
    const val = parseInt(card);
    if (['10', 'J', 'Q', 'K', 'A'].includes(card)) return -1;
    if (val >= 2 && val <= 6) return 1;
    return 0;
  };

  const updateCount = (val, isCard = false, cardStr = null) => {
    setSession(prev => ({ ...prev, runningCount: prev.runningCount + val, cardsDealt: prev.cardsDealt + 1 }));
    setHand(prev => ({ ...prev, actionStack: [...prev.actionStack, { type: isCard ? 'card' : 'quick', val, cardStr }] }));
  };

  const handleCardInput = (cardStr) => {
    if (hand.playerCards.length < 2) {
      setHand(prev => ({ ...prev, playerCards: [...prev.playerCards, cardStr] }));
      updateCount(getCardCountValue(cardStr), true, cardStr);
    } else if (!hand.dealerCard) {
      setHand(prev => ({ ...prev, dealerCard: cardStr }));
      updateCount(getCardCountValue(cardStr), true, cardStr);
    }
  };

  const undoLastAction = () => {
    if (hand.actionStack.length === 0) return;
    const last = hand.actionStack[hand.actionStack.length - 1];
    setSession(prev => ({ ...prev, runningCount: prev.runningCount - last.val, cardsDealt: prev.cardsDealt - 1 }));
    
    setHand(prev => {
      let newPlayerCards = prev.playerCards;
      let newDealerCard = prev.dealerCard;
      if (last.type === 'card') {
        if (newDealerCard) newDealerCard = null;
        else newPlayerCards = newPlayerCards.slice(0, -1);
      }
      return { ...prev, playerCards: newPlayerCards, dealerCard: newDealerCard, actionStack: prev.actionStack.slice(0, -1) };
    });
  };

  useEffect(() => {
    if (hand.playerCards.length === 2 && hand.dealerCard && phase === 'count') analyzeHand();
  }, [hand.playerCards, hand.dealerCard, phase]);

  const analyzeHand = async () => {
    try {
      const data = await apiFetch('/api/bj/analyze', 'POST', { 
        session_id: session.id, 
        player_cards: hand.playerCards, 
        dealer_upcard: hand.dealerCard,
        running_count: session.runningCount, // <-- ТЕПЕРЬ СИНХРОНИЗИРУЕМ СЕРВЕР С ФРОНТОМ
        cards_dealt: session.cardsDealt
      });
      setHand(prev => ({ ...prev, recommendation: data }));
      setPhase('action');
    } catch (e) { console.error(e); }
  };

  const submitResult = async (outcome, actualBet, recommendedBet) => {
    try {
      const data = await apiFetch('/api/bj/result', 'POST', {
        session_id: session.id,
        player_cards: hand.playerCards,
        dealer_upcard: hand.dealerCard,
        action_taken: 'UNKNOWN',
        action_recommended: hand.recommendation.action,
        actual_bet: actualBet,
        recommended_bet: recommendedBet,
        outcome: outcome,
        running_count: session.runningCount, // <-- ТЕПЕРЬ СИНХРОНИЗИРУЕМ СЕРВЕР С ФРОНТОМ
        cards_dealt: session.cardsDealt
      });
      setSession(prev => ({ ...prev, balance: data.new_balance, runningCount: data.new_running_count }));
      resetHand();
    } catch (e) { console.error(e); }
  };

  const resetHand = () => {
    setHand({ playerCards: [], dealerCard: null, recommendation: null, actionStack: [] });
    setPhase('count');
  };

  const getRecommendedBet = () => {
    const decksRemaining = Math.max(0.1, session.decks - (session.cardsDealt / 52));
    const trueCount = session.runningCount / decksRemaining;
    if (trueCount < 1.5) return session.minBet;
    
    let multiplier = 1;
    if (trueCount >= 1.5 && trueCount < 2.5) multiplier = 2;
    else if (trueCount >= 2.5 && trueCount < 3.5) multiplier = 4;
    else if (trueCount >= 3.5) multiplier = 8;
    
    return Math.min(session.maxBet, session.balance, Math.max(session.minBet, session.minBet * multiplier));
  };

  return { phase, setPhase, session, updateSessionConfig, startSession, hand, handleCardInput, updateCount, undoLastAction, submitResult, getRecommendedBet };
};