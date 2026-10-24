import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Access token sirf memory mein (localStorage mein NAHI)
let accessToken = null;

export const setAccessToken = (token) => {
    accessToken = token;
};

export const getAccessToken = () => accessToken;

// Clears the in-memory token and tells AuthContext to redirect to /login
export const forceLogout = () => {
  setAccessToken(null);
  window.dispatchEvent(new Event('auth:logout'));
};


// Main instance: interceptors iske upar
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

// Refresh ke liye alag "plain" instance, warna interceptor loop mein fas jayega
const plain = axios.create({ baseURL: BASE_URL, withCredentials: true });

// 1) Har request pe token laga do
api.interceptors.request.use((config) => {
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
    return config;
});

// 2) Ek time pe sirf EK refresh call hoga, baaki wahi promise wait karenge
let refreshPromise = null;

export const refreshAccessToken = () => {
    if (!refreshPromise) {
        
        refreshPromise = plain.post('/auth/refresh')
            .then((res) => {
                setAccessToken(res.data.accessToken);
                return res.data;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }
    return refreshPromise;
};

// 3) TOKEN_EXPIRED aaya? refresh karo, phir original request retry
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.code;

    // Session is dead on the server: no point trying to refresh
    if (status === 401 && (code === 'SESSION_REVOKED' || code === 'TOKEN_REUSE')) {
      forceLogout();
      return Promise.reject(error);
    }

    // Access token expired: refresh silently and retry the original request
    if (status === 401 && code === 'TOKEN_EXPIRED' && !original._retry) {
      original._retry = true;
      try {
        await refreshAccessToken();
        original.headers.Authorization = `Bearer ${getAccessToken()}`;
        return api(original);
      } catch (refreshErr) {
        forceLogout();
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);

export default api;