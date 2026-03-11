// src/utils/helpers.js
export const getSavedState = (key, defaultValue) => {
  const saved = localStorage.getItem(key);
  if (saved !== null) {
    try { return JSON.parse(saved); } catch (e) { return saved; }
  }
  return defaultValue;
};

export const getCurrencySymbol = (curr) => {
  switch(curr) { 
    case 'USD': return '$'; 
    case 'UAH': return '₴'; 
    case 'RUB': return '₽'; 
    case 'KZT': return '₸'; 
    default: return '$'; 
  }
};