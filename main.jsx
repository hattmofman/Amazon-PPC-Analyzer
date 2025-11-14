import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import App from './App.jsx';
import './index.css';

// Initialize Supabase
const supabaseClient = createClient(
  'https://qlqqdrnddwtzguqgtrub.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFscXFkcm5kZHd0emd1cWd0cnViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNjIyMzMsImV4cCI6MjA3ODYzODIzM30.UllszW_ETPYHNGBjOKPR6wJD4lHQZPiQ-vJCF9h8wWc'
);

function AppWrapper() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  
  useEffect(() => {
    // Get initial session
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    
    // Listen for auth changes
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div className="loader"></div>
        <p style={{ color: '#666' }}>Loading PPC Analyzer...</p>
      </div>
    );
  }
  
  return <App session={session} supabase={supabaseClient} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>
);
