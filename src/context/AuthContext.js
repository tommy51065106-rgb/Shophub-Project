import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

const AuthContext = createContext({
  user: null,
  loading: true,
  error: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refetchUser: async () => {} 
});

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [csrfToken, setCsrfToken] = useState('');
  const csrfTokenRef = useRef('');
  const csrfFetchRef = useRef(null);

  const fetchCsrfToken = () => {
    // Deduplicate: if a fetch is already in-flight, return the same promise
    // so concurrent callers share one result and don't issue competing tokens.
    if (csrfFetchRef.current) return csrfFetchRef.current;
    csrfFetchRef.current = (async () => {
      const res = await fetch('/api/csrf-token', {
        credentials: 'include'
      });
      if (!res.ok) {
        throw new Error('Unable to initialize CSRF token');
      }
      const data = await res.json();
      const token = data.csrfToken || '';
      csrfTokenRef.current = token;
      setCsrfToken(token);
      return token;
    })().finally(() => {
      csrfFetchRef.current = null;
    });
    return csrfFetchRef.current;
  };

  const ensureCsrfToken = async () => {
    if (csrfTokenRef.current) return csrfTokenRef.current;
    return fetchCsrfToken();
  };

  const fetchMe = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      if (!res.ok) {
        setUser(null);
        setError(null);
        return null;
      }
      const data = await res.json();
      setUser(data.user || null);
      setError(null);
      return data.user || null;
    } catch (err) {
      console.error('fetchMe error:', err);
      setUser(null);
      setError('Unable to validate session');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCsrfToken().catch(() => null);
    fetchMe();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const token = await ensureCsrfToken();
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }
      const u = await fetchMe();
      setError(null);
      return { success: true, user: u, data };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  };

  const register = async (name, email, password, confirm_password) => {
    setLoading(true);
    try {
      const token = await ensureCsrfToken();
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        credentials: 'include',
        body: JSON.stringify({ name, email, password, confirm_password, _csrf: token })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      const u = await fetchMe();
      setError(null);
      return { success: true, user: u, data };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      const token = await ensureCsrfToken();
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': token
        },
        credentials: 'include'
      });
      setUser(null);
      setError(null);
      return { success: true };
    } catch (err) {
      setError('Logout failed');
      return { success: false, error: 'Logout failed' };
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, refetchUser: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export { AuthProvider, useAuth };
