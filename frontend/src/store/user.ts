import { defineStore } from 'pinia';
import type { User } from '../types';

interface UserState {
  token: string;
  user: User | null;
  isLoggedIn: boolean;
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    token: '',
    user: null,
    isLoggedIn: false
  }),

  getters: {
    isAdmin: (state) => state.user?.role === 'admin' || state.user?.role === 'main_admin',
    isMainAdmin: (state) => state.user?.role === 'main_admin',
    isClub: (state) => state.user?.isClub || false
  },

  actions: {
    setToken(token: string) {
      this.token = token;
      uni.setStorageSync('token', token);
    },

    setUser(user: User) {
      this.user = user;
      this.isLoggedIn = true;
      uni.setStorageSync('user', user);
    },

    logout() {
      this.token = '';
      this.user = null;
      this.isLoggedIn = false;
      uni.removeStorageSync('token');
      uni.removeStorageSync('user');
      uni.reLaunch({ url: '/pages/login/index' });
    },

    // 从本地存储恢复状态
    restoreState() {
      const token = uni.getStorageSync('token');
      const user = uni.getStorageSync('user');

      if (token && user) {
        this.token = token;
        this.user = user;
        this.isLoggedIn = true;
      }
    }
  },

  persist: true
});
