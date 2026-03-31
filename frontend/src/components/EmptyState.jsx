/**
 * components/EmptyState.jsx
 * Placeholder khi không có dữ liệu.
 */
import React from 'react';

export default function EmptyState({ title, description, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <p className="text-gray-300 font-semibold text-sm">{title}</p>
      {description && <p className="text-gray-500 text-xs mt-1 max-w-xs">{description}</p>}
      {action && onAction && (
        <button
          onClick={onAction}
          className="mt-4 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold
                     px-4 py-2 rounded-lg transition-colors"
        >
          {action}
        </button>
      )}
    </div>
  );
}
