import { useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export const useRoulette = () => {
  const [sessionId, setSessionId] = useState(null);
  const [isVip, setIsVip] = useState(false);
  const [history, setHistory] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const getHeaders = () => {
    const initData = window.Telegram?.WebApp?.initData || '';
    return {
      'Content-Type': 'application/json',
      'X-Tg-Init-Data': initData,
    };
  };

  const startSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/roulette/session`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to start session');
      const data = await res.json();
      
      setSessionId(data.session_id);
      setIsVip(data.is_vip);
      setHistory([]);
      setAnalysis(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncHistory = useCallback(async (numbers) => {
    if (!sessionId) return;
    setIsSyncing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/roulette/sync`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ session_id: sessionId, numbers }),
      });
      if (!res.ok) throw new Error('Failed to sync history');
      const data = await res.json();
      
      setHistory(numbers);
      setAnalysis(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  }, [sessionId]);

  const addSpin = useCallback(async (number) => {
    if (!sessionId) return;
    
    setHistory((prev) => [...prev, number]);
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/roulette/spin`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ session_id: sessionId, number }),
      });
      if (!res.ok) throw new Error('Failed to add spin');
      const data = await res.json();
      
      setAnalysis(data);
    } catch (err) {
      setError(err.message);
      setHistory((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  return {
    sessionId,
    isVip,
    history,
    analysis,
    isLoading,
    error,
    isSyncing,
    startSession,
    syncHistory,
    addSpin
  };
};