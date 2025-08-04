import React, { useEffect } from 'react'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

/**
 * Debug component to extract actual colors from vscDarkPlus theme
 */
export const DebugTheme: React.FC = () => {
  useEffect(() => {
    console.log('=== ACTUAL vscDarkPlus THEME COLORS ===');
    console.log(JSON.stringify(vscDarkPlus, null, 2));
    
    // Extract specific token colors
    Object.entries(vscDarkPlus).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null && 'color' in value) {
        console.log(`${key}: ${(value as any).color}`);
      }
    });
  }, []);

  return (
    <div style={{ padding: '20px', background: '#1e1e1e', color: '#d4d4d4' }}>
      <h3>Debug Theme Colors</h3>
      <p>Check the browser console for the actual vscDarkPlus theme colors!</p>
      <pre style={{ background: '#2d2d30', padding: '10px', borderRadius: '4px' }}>
        {JSON.stringify(vscDarkPlus, null, 2)}
      </pre>
    </div>
  );
};