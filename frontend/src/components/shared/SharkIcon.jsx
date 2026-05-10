import React from 'react';

/**
 * Premium Shark Icon (SVG)
 * Standardized for VNInvest Whale Intelligence.
 */
export default function SharkIcon({ className = 'w-4 h-4', color = 'currentColor' }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
      aria-hidden="true"
    >
      <path 
        d="M21.5 12C21.5 12 18.5 8 14.5 8C13.5 8 11.5 8.5 10 9.5C8.5 10.5 7 12 7 12C7 12 8.5 13.5 10 14.5C11.5 15.5 13.5 16 14.5 16C18.5 16 21.5 12 21.5 12Z" 
        stroke={color} 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <path 
        d="M7 12C7 12 5.5 11 4.5 11C3.5 11 2.5 11.5 2.5 12.5C2.5 13.5 3.5 14 4.5 14C5.5 14 7 12 7 12Z" 
        stroke={color} 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <path 
        d="M10 9.5L9 6.5C9 6.5 11 6 12.5 7.5" 
        stroke={color} 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <path 
        d="M14.5 8C14.5 8 15.5 5 18 5" 
        stroke={color} 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <path 
        d="M14.5 16C14.5 16 15.5 19 18 19" 
        stroke={color} 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <circle cx="17.5" cy="11.5" r="0.75" fill={color} />
    </svg>
  );
}
