import React from 'react';
import ChatWindow from './components/ChatWindow';

/**
 * Personal Brain Single-Screen Productivity Dashboard Shell
 */
export default function App() {
  return (
    <div style={styles.appShell}>
      <ChatWindow />
    </div>
  );
}

const styles = {
  appShell: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    backgroundColor: 'var(--bg-app)',
    overflow: 'hidden'
  }
};
