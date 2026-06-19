import React, { createContext, useContext, useState, useEffect } from 'react';

const InterfaceContext = createContext();

export const InterfaceProvider = ({ children }) => {
  const [uiMode, setUiMode] = useState(() => {
    // Check localStorage for saved preference; default to modern for production.
    const saved = localStorage.getItem('vninvest_ui_pref');
    return saved === 'legacy' ? 'legacy' : 'modern';
  });
  const [modernLeftSidebarOpen, setModernLeftSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('vninvest_modern_left_sidebar_open');
    return saved !== '0';
  });

  useEffect(() => {
    localStorage.setItem('vninvest_ui_pref', uiMode);
  }, [uiMode]);

  useEffect(() => {
    localStorage.setItem('vninvest_modern_left_sidebar_open', modernLeftSidebarOpen ? '1' : '0');
  }, [modernLeftSidebarOpen]);

  const toggleUiMode = () => {
    setUiMode(prev => (prev === 'legacy' ? 'modern' : 'legacy'));
  };

  const toggleModernLeftSidebar = () => {
    setModernLeftSidebarOpen((prev) => !prev);
  };

  return (
    <InterfaceContext.Provider
      value={{
        uiMode,
        setUiMode,
        toggleUiMode,
        modernLeftSidebarOpen,
        setModernLeftSidebarOpen,
        toggleModernLeftSidebar,
      }}
    >
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
