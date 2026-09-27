let mockStateVal = {};
let mockStateSetters = {};
let mockEffects = [];
let mockRefCurrent = {};
let mockCallbackId = 0;

const mockUseState = (initial) => {
  const stateKey = typeof initial === "function" ? "computed" : JSON.stringify(initial);
  if (!(stateKey in mockStateVal)) {
    mockStateVal[stateKey] = typeof initial === "function" ? initial() : initial;
  }
  const setter = (val) => {
    if (typeof val === "function") {
      mockStateVal[stateKey] = val(mockStateVal[stateKey]);
    } else {
      mockStateVal[stateKey] = val;
    }
    if (mockStateSetters[stateKey]) {
      mockStateSetters[stateKey](mockStateVal[stateKey]);
    }
  };
  return [mockStateVal[stateKey], setter];
};

module.exports = {
  useState: mockUseState,
  useEffect: (effect, deps) => { mockEffects.push({ effect, deps }); },
  useRef: (initial) => {
    const refKey = JSON.stringify(initial);
    if (!(refKey in mockRefCurrent)) {
      mockRefCurrent[refKey] = { current: initial };
    }
    return mockRefCurrent[refKey];
  },
  useCallback: (fn) => { mockCallbackId++; return fn; },
  useMemo: (fn) => fn(),
  createContext: (initialVal) => ({
    Provider: ({ value, children }) => children,
    Consumer: ({ children }) => children(initialVal),
    _currentValue: initialVal,
  }),
  useContext: (context) => context?._currentValue,
  createElement: () => ({}),
  // helpers for tests to inspect/reset state
  _getMockState: () => mockStateVal,
  _getMockEffects: () => mockEffects,
  _resetMockState: () => {
    mockStateVal = {};
    mockStateSetters = {};
    mockEffects = [];
    mockRefCurrent = {};
  },
};
