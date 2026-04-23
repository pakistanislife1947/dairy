// frontend/src/hooks/useLogo.js
// Drop-in hook — call this in your AdminLayout/Sidebar to get the live logo

import { useState, useEffect } from 'react';
import api from '../api/client';

export function useLogo() {
  const [logo, setLogo]     = useState(null);
  const [name, setName]     = useState('Dairy ERP');
  const [loading, setLoading] = useState(true);

  const fetchLogo = () => {
    api.get('/settings')
      .then(({ data }) => {
        setLogo(data.settings?.logo_url || null);
        setName(data.settings?.logo_name || 'Dairy ERP');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogo();
    // Re-fetch when admin saves a new logo (Settings.jsx fires this event)
    window.addEventListener('logo-updated', fetchLogo);
    return () => window.removeEventListener('logo-updated', fetchLogo);
  }, []);

  return { logo, name, loading };
}
