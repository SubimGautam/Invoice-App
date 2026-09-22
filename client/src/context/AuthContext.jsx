import { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

function readWorkspace() {
  try {
    return JSON.parse(localStorage.getItem('workspace'));
  } catch {
    return null;
  }
}

function readUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    /* ignore corrupt localStorage */
    return null;
  }
}

export function AuthProvider({ children }) {
  // The session is restored synchronously from localStorage on first render, so
  // there's no async hydration step — no effect needed.
  const [user, setUser] = useState(readUser);
  const [workspace, setWorkspace] = useState(readWorkspace);
  const [loading] = useState(false);

  const store = useCallback((data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    if (data.workspace) localStorage.setItem('workspace', JSON.stringify(data.workspace));
    setUser(data.user);
    setWorkspace(data.workspace || null);
  }, []);

  async function login(email, password) {
    const data = await api.login(email, password);
    store(data);
  }

  async function signup(name, email, password) {
    const data = await api.signup(name, email, password);
    store(data);
  }

  // Replaces the stored token + active workspace (used after joining a
  // workspace, creating one, or switching the active workspace).
  function applySession(session) {
    localStorage.setItem('token', session.token);
    if (session.workspace) {
      localStorage.setItem('workspace', JSON.stringify(session.workspace));
      setWorkspace(session.workspace);
    }
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('workspace');
    setUser(null);
    setWorkspace(null);
  }

  // Merge fields into the active workspace (e.g. after a rename).
  function updateWorkspace(partial) {
    setWorkspace((w) => {
      const next = { ...(w || {}), ...partial };
      localStorage.setItem('workspace', JSON.stringify(next));
      return next;
    });
  }

  const role = workspace?.role || null;
  const canManage = role === 'owner' || role === 'admin';
  const canWrite = canManage || role === 'staff';

  return (
    <AuthContext.Provider
      value={{ user, workspace, role, canManage, canWrite, loading, login, signup, store, applySession, updateWorkspace, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}