import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
};

const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN || ''; // e.g. your-domain.auth.us-east-1.amazoncognito.com
const APP_BASE_URL = import.meta.env.VITE_APP_URL || window.location.origin;

const userPool = poolData.UserPoolId ? new CognitoUserPool(poolData) : null;

const DEMO_USER = {
  email: 'demo@clienta.ai',
  tenantId: 'demo-tenant',
  role: 'admin',
  sub: 'demo-user-001',
};

const isDemoMode = !userPool;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(isDemoMode ? DEMO_USER : null);
  const [token, setToken] = useState(isDemoMode ? 'demo-token' : null);
  const [loading, setLoading] = useState(!isDemoMode);

  const extractUserData = useCallback((session) => {
    const idToken = session.getIdToken();
    const payload = idToken.decodePayload();
    return {
      email: payload.email,
      tenantId: payload['custom:tenant_id'],
      role: payload['custom:role'],
      sub: payload.sub,
    };
  }, []);

  useEffect(() => {
    if (isDemoMode) return;
    if (!userPool) {
      setLoading(false);
      return;
    }
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      setLoading(false);
      return;
    }
    cognitoUser.getSession((err, session) => {
      if (err || !session?.isValid()) {
        setLoading(false);
        return;
      }
      setToken(session.getIdToken().getJwtToken());
      setUser(extractUserData(session));
      setLoading(false);
    });
  }, [extractUserData]);

  const signIn = useCallback((email, password) => {
    if (isDemoMode) {
      setUser(DEMO_USER);
      setToken('demo-token');
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      if (!userPool) {
        reject(new Error('Cognito is not configured. Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID.'));
        return;
      }
      const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
      const authDetails = new AuthenticationDetails({ Username: email, Password: password });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session) => {
          const jwt = session.getIdToken().getJwtToken();
          setToken(jwt);
          setUser(extractUserData(session));
          resolve(session);
        },
        onFailure: (err) => reject(err),
        newPasswordRequired: () => {
          reject(new Error('New password required. Please contact support.'));
        },
      });
    });
  }, [extractUserData]);

  const signOut = useCallback(() => {
    if (!userPool) return;
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) cognitoUser.signOut();
    setUser(null);
    setToken(null);
  }, []);

  /**
   * Redirect to Cognito Hosted UI for Google federated sign-in.
   * Requires VITE_COGNITO_DOMAIN to be set in .env.
   */
  const signInWithGoogle = useCallback(() => {
    if (!COGNITO_DOMAIN || !poolData.ClientId) {
      console.error('VITE_COGNITO_DOMAIN or VITE_COGNITO_CLIENT_ID is not configured.');
      return;
    }
    const redirectUri = encodeURIComponent(`${APP_BASE_URL}/login`);
    const url =
      `https://${COGNITO_DOMAIN}/oauth2/authorize` +
      `?identity_provider=Google` +
      `&redirect_uri=${redirectUri}` +
      `&response_type=code` +
      `&client_id=${poolData.ClientId}` +
      `&scope=openid%20email%20profile`;
    window.location.href = url;
  }, []);

  /**
   * Send a password-reset verification code to the user's email.
   */
  const forgotPassword = useCallback((email) => {
    return new Promise((resolve, reject) => {
      if (!userPool) return reject(new Error('Cognito not configured'));
      const cognitoUser = new CognitoUser({ Username: email.trim().toLowerCase(), Pool: userPool });
      cognitoUser.forgotPassword({
        onSuccess: resolve,
        onFailure: reject,
      });
    });
  }, []);

  /**
   * Confirm a new password with the code received by email.
   */
  const confirmNewPassword = useCallback((email, code, newPassword) => {
    return new Promise((resolve, reject) => {
      if (!userPool) return reject(new Error('Cognito not configured'));
      const cognitoUser = new CognitoUser({ Username: email.trim().toLowerCase(), Pool: userPool });
      cognitoUser.confirmPassword(code, newPassword, {
        onSuccess: resolve,
        onFailure: reject,
      });
    });
  }, []);

  /**
   * Exchange a Cognito OAuth2 authorization code for tokens.
   * Called by Login.jsx when the Hosted UI redirects back with ?code=...
   */
  const handleOAuthCallback = useCallback(async (code) => {
    if (!COGNITO_DOMAIN || !poolData.ClientId) {
      throw new Error('VITE_COGNITO_DOMAIN is not configured.');
    }
    const redirectUri = `${APP_BASE_URL}/login`;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: poolData.ClientId,
      code,
      redirect_uri: redirectUri,
    });

    const resp = await fetch(`https://${COGNITO_DOMAIN}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = await resp.json();
    if (!resp.ok || data.error) {
      throw new Error(data.error_description || data.error || 'OAuth token exchange failed');
    }

    const idToken = data.id_token;
    // Decode JWT payload (base64url)
    const payloadB64 = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(payloadB64));

    setToken(idToken);
    setUser({
      email: payload.email,
      tenantId: payload['custom:tenant_id'] || null,
      role: payload['custom:role'] || 'owner',
      sub: payload.sub,
    });
  }, []);

  const value = {
    user, token, loading, signIn, signOut, signInWithGoogle, handleOAuthCallback,
    forgotPassword, confirmNewPassword,
    isAuthenticated: !!token, isDemoMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
