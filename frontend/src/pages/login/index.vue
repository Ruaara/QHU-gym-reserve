<template>
  <view class="login-container">
    <view class="logo-section">
      <text class="logo-title">QHU 健身房预约</text>
      <text class="logo-subtitle">青海大学健身房预约系统</text>
    </view>

    <view class="form-section">
      <!-- 登录表单 -->
      <view v-if="!isRegister" class="form">
        <view class="form-item">
          <text class="label">账号</text>
          <input
            v-model="loginForm.account"
            class="input"
            placeholder="请输入学号"
            type="text"
          />
        </view>

        <view class="form-item">
          <text class="label">密码</text>
          <input
            v-model="loginForm.password"
            class="input"
            placeholder="请输入密码"
            type="password"
          />
        </view>

        <button class="btn btn-primary btn-block" @click="handleLogin">
          登录
        </button>

        <view class="footer-text">
          <text>还没有账号？</text>
          <text class="link" @click="isRegister = true">立即注册</text>
        </view>
      </view>

      <!-- 注册表单 -->
      <view v-else class="form">
        <view class="form-item">
          <text class="label">姓名</text>
          <input
            v-model="registerForm.name"
            class="input"
            placeholder="请输入姓名"
            type="text"
          />
        </view>

        <view class="form-item">
          <text class="label">学号</text>
          <input
            v-model="registerForm.account"
            class="input"
            placeholder="请输入学号"
            type="text"
          />
        </view>

        <view class="form-item">
          <text class="label">密码</text>
          <input
            v-model="registerForm.password"
            class="input"
            placeholder="请输入密码"
            type="password"
          />
        </view>

        <view class="form-item">
          <text class="label">确认密码</text>
          <input
            v-model="registerForm.confirmPassword"
            class="input"
            placeholder="请再次输入密码"
            type="password"
          />
        </view>

        <button class="btn btn-primary btn-block" @click="handleRegister">
          注册
        </button>

        <view class="footer-text">
          <text>已有账号？</text>
          <text class="link" @click="isRegister = false">立即登录</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useUserStore } from '@/store/user';
import { login, register } from '@/api';

const userStore = useUserStore();

const isRegister = ref(false);

// 登录表单
const loginForm = ref({
  account: '',
  password: ''
});

// 注册表单
const registerForm = ref({
  name: '',
  account: '',
  password: '',
  confirmPassword: ''
});

// 处理登录
const handleLogin = async () => {
  const { account, password } = loginForm.value;

  if (!account || !password) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' });
    return;
  }

  try {
    uni.showLoading({ title: '登录中...' });

    const res = await login({ account, password });

    userStore.setToken(res.token);
    userStore.setUser(res.user);

    uni.hideLoading();
    uni.showToast({ title: '登录成功', icon: 'success' });

    setTimeout(() => {
      uni.switchTab({ url: '/pages/home/index' });
    }, 500);
  } catch (error: any) {
    uni.hideLoading();
    uni.showToast({ title: error.error || '登录失败', icon: 'none' });
  }
};

// 处理注册
const handleRegister = async () => {
  const { name, account, password, confirmPassword } = registerForm.value;

  if (!name || !account || !password) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' });
    return;
  }

  if (password !== confirmPassword) {
    uni.showToast({ title: '两次密码不一致', icon: 'none' });
    return;
  }

  if (password.length < 6) {
    uni.showToast({ title: '密码长度不能少于6位', icon: 'none' });
    return;
  }

  try {
    uni.showLoading({ title: '注册中...' });

    const res = await register({ name, account, password });

    userStore.setToken(res.token);
    userStore.setUser(res.user);

    uni.hideLoading();
    uni.showToast({ title: '注册成功', icon: 'success' });

    setTimeout(() => {
      uni.switchTab({ url: '/pages/home/index' });
    }, 500);
  } catch (error: any) {
    uni.hideLoading();
    uni.showToast({ title: error.error || '注册失败', icon: 'none' });
  }
};
</script>

<style lang="scss" scoped>
.login-container {
  min-height: 100vh;
  padding: 60rpx 40rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.logo-section {
  text-align: center;
  margin-bottom: 80rpx;
  margin-top: 80rpx;

  .logo-title {
    display: block;
    font-size: 56rpx;
    font-weight: bold;
    color: #fff;
    margin-bottom: 16rpx;
  }

  .logo-subtitle {
    display: block;
    font-size: 28rpx;
    color: rgba(255, 255, 255, 0.8);
  }
}

.form-section {
  .form {
    background: #fff;
    border-radius: 24rpx;
    padding: 48rpx 40rpx;
    box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
  }

  .form-item {
    margin-bottom: 32rpx;

    .label {
      display: block;
      font-size: 28rpx;
      color: #333;
      margin-bottom: 16rpx;
    }

    .input {
      width: 100%;
      height: 88rpx;
      padding: 0 24rpx;
      border: 2rpx solid #e5e7eb;
      border-radius: 12rpx;
      font-size: 28rpx;
      background: #f9fafb;

      &:focus {
        border-color: #667eea;
        background: #fff;
      }
    }
  }

  .btn {
    height: 88rpx;
    line-height: 88rpx;
    border-radius: 12rpx;
    font-size: 32rpx;
    border: none;
    margin-top: 24rpx;

    &.btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
    }

    &.btn-block {
      width: 100%;
    }
  }

  .footer-text {
    text-align: center;
    margin-top: 32rpx;
    font-size: 28rpx;
    color: #6b7280;

    .link {
      color: #667eea;
      margin-left: 8rpx;
    }
  }
}
</style>
