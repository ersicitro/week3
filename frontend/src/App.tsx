import React, { useState, useEffect, useCallback } from 'react';
import { Layout, ConfigProvider } from 'antd';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
  Outlet
} from 'react-router-dom';
import zhCN from 'antd/locale/zh_CN';
import BillHeader from './components/BillHeader';
import BillList from './components/BillList';
import LoginPage from './components/LoginPage';
import axios, { AxiosInstance } from 'axios';
import { jwtDecode } from 'jwt-decode';
import './App.css';

const { Header, Content } = Layout;

interface DecodedToken {
  exp: number;
  iat: number;
  jti: string;
  token_type: string;
  user_id: number;
  username: string;
}

// Function to get token from localStorage
const getAuthToken = () => localStorage.getItem('accessToken');
const getRefreshToken = () => localStorage.getItem('refreshToken');
const getUsernameFromStorage = () => localStorage.getItem('username');

// Configure axios instance to include the token
const apiClient = axios.create({
  baseURL: 'http://localhost:8001',
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Axios interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          const rs = await axios.post('http://localhost:8001/api/token/refresh/', {
            refresh: refreshToken,
          });
          const { access } = rs.data;
          localStorage.setItem('accessToken', access);
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${access}`;
          originalRequest.headers['Authorization'] = `Bearer ${access}`;
          return apiClient(originalRequest);
        } catch (_error) {
          console.error("Token refresh failed", _error);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('username');
          window.dispatchEvent(new Event('authFailed'));
          return Promise.reject(_error);
        }
      }
    }
    return Promise.reject(error);
  }
);

// Main application layout for authenticated users
const MainAppLayout: React.FC = () => {
  const navigate = useNavigate();
  const { username: usernameFromParams } = useParams<{ username: string }>();
  const storedUsername = getUsernameFromStorage();
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);

  useEffect(() => {
    if (usernameFromParams && storedUsername && usernameFromParams !== storedUsername) {
      console.warn("URL username mismatch. Redirecting...");
      navigate(`/page/${storedUsername}`, { replace: true });
    }
  }, [usernameFromParams, storedUsername, navigate]);

  const triggerSummaryRefresh = useCallback(() => {
    setSummaryRefreshKey(prevKey => prevKey + 1);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    apiClient.defaults.headers.common['Authorization'] = null;
    window.dispatchEvent(new Event('authChanged'));
  }, [navigate]);
  

  if (!storedUsername) {
      return <Navigate to="/login" replace />;
  }

  return (
    <Layout className="layout">
      <Header className="header">
        <BillHeader 
          refreshKey={summaryRefreshKey} 
          apiClient={apiClient} 
          username={storedUsername} 
          onLogout={handleLogout} 
        /> 
      </Header>
      <Content className="content">
        <BillList onDataChange={triggerSummaryRefresh} apiClient={apiClient} />
      </Content>
    </Layout>
  );
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getAuthToken());
  const [username, setUsername] = useState<string | null>(getUsernameFromStorage());
  const navigate = useNavigate();

  const handleLoginSuccess = useCallback((token: string, refreshToken: string) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', refreshToken);
    try {
      const decodedToken = jwtDecode<DecodedToken>(token);
      localStorage.setItem('username', decodedToken.username);
      setUsername(decodedToken.username);
      setIsAuthenticated(true);
      navigate(`/page/${decodedToken.username}`);
    } catch (error) {
      console.error("Failed to decode token on login", error);
      setIsAuthenticated(false);
      setUsername(null);
    }
  }, [navigate]);

  const reEvaluateAuthState = useCallback(() => {
    const currentToken = getAuthToken();
    const currentUsername = getUsernameFromStorage();
    if (!currentToken) {
        if (isAuthenticated) setIsAuthenticated(false);
        if (username) setUsername(null);
        navigate('/login', { replace: true });
    } else {
        if(!isAuthenticated) setIsAuthenticated(true);
        if(!username && currentUsername) setUsername(currentUsername);
        if (window.location.pathname === '/login' || window.location.pathname === '/') {
            navigate(currentUsername ? `/page/${currentUsername}` : '/login', { replace: true });
        }
    }
  }, [isAuthenticated, username, navigate]);

  useEffect(() => {
    reEvaluateAuthState();
    
    const handleAuthChange = () => reEvaluateAuthState();
    const handleAuthFailed = () => {
        setIsAuthenticated(false);
        setUsername(null);
        navigate('/login', { replace: true });
    };

    window.addEventListener('authChanged', handleAuthChange);
    window.addEventListener('authFailed', handleAuthFailed);
    window.addEventListener('storage', (event) => {
      if (event.key === 'accessToken' || event.key === 'username') {
        handleAuthChange();
      }
    });

    return () => {
      window.removeEventListener('authChanged', handleAuthChange);
      window.removeEventListener('authFailed', handleAuthFailed);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, [reEvaluateAuthState]);
  

  return (
    <ConfigProvider locale={zhCN}>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <LoginPage onLoginSuccess={handleLoginSuccess} /> : <Navigate to={username ? `/page/${username}` : "/login"} replace />} />
        <Route path="/page/:username" element={isAuthenticated ? <MainAppLayout /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to={isAuthenticated && username ? `/page/${username}` : "/login"} replace />} />
      </Routes>
    </ConfigProvider>
  );
};

export default App;
