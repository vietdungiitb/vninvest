import React, { createContext, useContext, useState, useEffect } from 'react';

const InterfaceContext = createContext();

export const InterfaceProvider = ({ children }) => {
  const [uiMode, setUiMode] = useState(() => {
    // Check localStorage for saved preference
    const saved = localStorage.getItem('vninvest_ui_pref');
    return saved === 'modern' ? 'modern' : 'legacy';
  });

  useEffect(() => {
    localStorage.setItem('vninvest_ui_pref', uiMode);
  }, [uiMode]);

  const toggleUiMode = () => {
    setUiMode(prev => (prev === 'legacy' ? 'modern' : 'legacy'));
  };

  return (
    <InterfaceContext.Provider value={{ uiMode, setUiMode, toggleUiMode }}>
      {children}
    </InterfaceContext.Provider>
  );
};

export const useInterface = () => {
  const context = useContext(InterfaceContext);
  if (!context) {
    throw new Error('useInterface must be used within an InterfaceProvider');
  }
  return context;
};
