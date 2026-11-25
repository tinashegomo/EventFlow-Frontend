import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { login as apiLogin, register as apiRegister, logout as apiLogout, getMe, getOrganization } from '../api/auth';
import { getToken, clearToken } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then((profile) => {
        setUser(profile);
        if (profile.organizationId) {
          return getOrganization(profile.organizationId).then(setOrganization).catch(() => setOrganization({ id: profile.organizationId }));
        }
      })
      .catch(() => {
        clearToken();
        setProfileError('Could not load your profile');
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email, password) => {
    const data = await apiLogin(email, password);
    const profile = await getMe();
    setUser(profile);
    if (data.organizationId) {
      getOrganization(data.organizationId).then(setOrganization).catch(() => setOrganization({ id: data.organizationId }));
    } else {
      setOrganization({ id: data.organizationId });
    }
    return data;
  }, []);

  const signUp = useCallback(async (email, password, fullName, orgName) => {
    const data = await apiRegister(email, password, fullName, orgName);
    const profile = await getMe();
    setUser(profile);
    if (data.organizationId) {
      getOrganization(data.organizationId).then(setOrganization).catch(() => setOrganization({ id: data.organizationId }));
    }
    return data;
  }, []);

  const signOut = useCallback(async () => {
    apiLogout();
    setUser(null);
    setOrganization(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await getMe();
      setUser(profile);
    } catch {
      // Keep the current profile if the refresh fails.
    }
  }, []);

  const value = {
    user,
    profile: user,
    organization,
    currentOrg: organization,
    loading,
    profileError,
    isAuthenticated: !!user,
    isEmailVerified: true,
    isAdmin: user?.role === 'ADMIN',
    signOut,
    signIn,
    signUp,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
