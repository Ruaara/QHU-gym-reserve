// API 请求工具
const BASE_URL = import.meta.env.DEV ? '/api' : 'http://your-server-url:3000/api';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  headers?: Record<string, string>;
}

// 获取 token
const getToken = (): string => {
  return uni.getStorageSync('token') || '';
};

// 通用请求方法
export const request = <T = any>(url: string, options: RequestOptions = {}): Promise<T> => {
  const { method = 'GET', data, headers } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers
  };

  // 添加认证 token
  const token = getToken();
  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: requestHeaders,
      success: (res: any) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
        } else if (res.statusCode === 401) {
          // token 过期，清除本地存储并跳转登录页
          uni.removeStorageSync('token');
          uni.removeStorageSync('user');
          uni.reLaunch({ url: '/pages/login/index' });
          reject(res.data);
        } else {
          reject(res.data);
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
};

// GET 请求
export const get = <T = any>(url: string, data?: any): Promise<T> => {
  return request<T>(url, { method: 'GET', data });
};

// POST 请求
export const post = <T = any>(url: string, data?: any): Promise<T> => {
  return request<T>(url, { method: 'POST', data });
};

// PUT 请求
export const put = <T = any>(url: string, data?: any): Promise<T> => {
  return request<T>(url, { method: 'PUT', data });
};

// DELETE 请求
export const del = <T = any>(url: string, data?: any): Promise<T> => {
  return request<T>(url, { method: 'DELETE', data });
};
