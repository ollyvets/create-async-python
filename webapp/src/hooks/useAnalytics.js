import { useState, useEffect } from 'react';

export const useAnalytics = (initData) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch('/api/bj/analytics', {
          headers: {
            'Content-Type': 'application/json',
            'X-TG-Init-Data': initData
          }
        });
        if (!res.ok) throw new Error('Failed to fetch analytics');
        const data = await res.json();
        
        setSessions(data.sessions);
        if (data.sessions.length > 0) {
          setSelectedSession(data.sessions[0]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [initData]);

  return { sessions, loading, error, selectedSession, setSelectedSession };
};