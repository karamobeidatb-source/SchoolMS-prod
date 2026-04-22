import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

function decorateUser(userData) {
  if (userData && userData.first_name && !userData.name) {
    userData.name = `${userData.first_name} ${userData.last_name || ''}`.trim();
  }
  return userData;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [activeSchool, setActiveSchool] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          const userData = decorateUser(res.data.user || res.data);
          if (res.data.permissions) userData.permissions = res.data.permissions;
          setUser(userData);
          setActiveSchool(res.data.activeSchool || null);
        })
        .catch(() => {
          localStorage.removeItem('token');
          setUser(null);
          setActiveSchool(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (phone, password) => {
    const res = await api.post('/auth/login', { phone, password });
    const { token } = res.data;
    localStorage.setItem('token', token);
    const meRes = await api.get('/auth/me');
    const userData = decorateUser(meRes.data.user || meRes.data);
    if (meRes.data.permissions) userData.permissions = meRes.data.permissions;
    setUser(userData);
    setActiveSchool(meRes.data.activeSchool || null);
    return { user: userData, activeSchool: meRes.data.activeSchool || null };
  };

  // Super admin selects / switches / clears the active school.
  const selectSchool = async (schoolId) => {
    const res = await api.post('/auth/select-school', { school_id: schoolId });
    localStorage.setItem('token', res.data.token);
    setActiveSchool(res.data.activeSchool || null);
    return res.data.activeSchool || null;
  };

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    setActiveSchool(null);
  }, []);

  const hasPermission = useCallback(
    (key) => {
      if (!user) return false;
      if (user.role_key === 'super_admin' || user.role_key === 'principal') return true;
      const perms = user.permissions || [];
      return perms.includes(key);
    },
    [user]
  );

  const isSuperAdmin = user?.role_key === 'super_admin';
  const needsSchool = isSuperAdmin && !activeSchool;

  return (
    <AuthContext.Provider value={{
      user,
      activeSchool,
      login,
      logout,
      selectSchool,
      loading,
      hasPermission,
      isSuperAdmin,
      needsSchool,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
