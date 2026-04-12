import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Catch render errors and show them instead of a blank page
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  componentDidCatch(error, info) {
    console.error('App crashed:', error, info);
    this.setState({ error: error.message });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', color: '#f87171', background: '#0f1117', minHeight: '100vh' }}>
          <h2 style={{ marginBottom: 16 }}>App Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error}</pre>
          <p style={{ marginTop: 20, color: '#8b93a8', fontSize: 13 }}>Check the browser console for full details.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
