/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from 'react';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext();

function readStoredUser() {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (!token) {
    return null;
  }

  try {
    const decoded = jwtDecode(token);
    if (decoded.exp * 1000 < Date.now()) {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      return null;
    }

    return { ...decoded, role: decoded.role || role };
  } catch {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => readStoredUser());
  const loading = false;

  const login = (token) => {
    localStorage.setItem('token', token);
    const decoded = jwtDecode(token);
    if (decoded.role) {
      localStorage.setItem('role', decoded.role);
    }
    setUser(decoded);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setUser(null);
  };

  const value = useMemo(() => ({ user, login, logout, loading }), [loading, user]);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
