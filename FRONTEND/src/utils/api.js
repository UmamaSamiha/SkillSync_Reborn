import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// 🔥 Attach token safely
api.interceptors.request.use(
  config => {
    const token =
      localStorage.getItem('access_token') ||
      localStorage.getItem('token');

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  error => Promise.reject(error)
);

// 🔥 Refresh logic (unchanged but safe)
api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;

    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;

      const refresh = localStorage.getItem('refresh_token');

      if (refresh) {
        try {
          const res = await axios.post(
            'http://127.0.0.1:5000/api/auth/refresh',
            {},
            {
              headers: {
                Authorization: `Bearer ${refresh}`,
              },
            }
          );

          const newToken = res.data?.data?.access_token;

          if (newToken) {
            localStorage.setItem('access_token', newToken);

            original.headers = original.headers || {};
            original.headers.Authorization = `Bearer ${newToken}`;

            return api(original);
          }
        } catch (e) {
          localStorage.clear();
          window.location.href = '/login';
        }
      } else {
        localStorage.clear();
        window.location.href = '/login';
      }
    }

    return Promise.reject(err);
  }
);

export default api;