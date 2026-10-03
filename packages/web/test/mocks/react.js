/**
 * Fake React hooks — CHỈ dùng cho `dashboard_lifecycle.test.js`.
 *
 * KHÔNG được đặt lại vào `<rootDir>/__mocks__/react.js`.
 * Jest tự áp manual mock của **node module** cho MỌI test suite, không cần
 * `jest.mock("react")`. Đặt ở `__mocks__/` đã làm hỏng 11/18 suite
 * (`react.forwardRef is not a function`, `Cannot read properties of undefined
 * (reading 'S')`) — 250 test không chạy được — để sửa 1 suite 5 test.
 * Xem Entry 234 trong `docs/CODE_CHANGE_AUDIT_LEDGER.md`.
 *
 * Consumer phải trỏ tường minh:
 *   jest.mock("react", () => require("<path>/test/mocks/react.js"));
 *
 * Fix bền vững hơn (CHƯA LÀM): viết lại `dashboard_lifecycle.test.js` bằng
 * `renderHook` thật của @testing-library/react, xoá hẳn harness giả này.
 */
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
