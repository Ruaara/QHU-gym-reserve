<template>
  <view class="settings-container">
    <view class="header">
      <text class="title">系统设置</text>
    </view>

    <view class="section">
      <view class="section-title">预约设置</view>
      <view class="setting-item">
        <view class="setting-label">
          <text class="label-text">预约开放时间</text>
          <text class="label-desc">每天开放预约第二天的时间点</text>
        </view>
        <view class="setting-value">
          <picker
            mode="time"
            :value="bookingOpenTime"
            @change="onTimeChange"
          >
            <view class="time-picker">
              <text>{{ bookingOpenTime }}</text>
              <text class="picker-arrow">›</text>
            </view>
          </picker>
        </view>
      </view>
    </view>

    <view class="actions">
      <button class="btn-save" @click="saveSettings">保存设置</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { getSystemSettings, updateSystemSettings } from '@/api';

const bookingOpenTime = ref('20:00');
const loading = ref(false);

// 加载系统设置
const loadSettings = async () => {
  try {
    const res = await getSystemSettings();
    bookingOpenTime.value = res.settings['booking_open_time']?.value || '20:00';
  } catch (error) {
    console.error('加载系统设置失败', error);
    uni.showToast({ title: '加载设置失败', icon: 'none' });
  }
};

// 时间选择器变化
const onTimeChange = (e: any) => {
  bookingOpenTime.value = e.detail.value;
};

// 保存设置
const saveSettings = async () => {
  if (loading.value) return;

  try {
    loading.value = true;
    uni.showLoading({ title: '保存中...' });

    await updateSystemSettings({
      booking_open_time: bookingOpenTime.value
    });

    uni.hideLoading();
    uni.showToast({ title: '保存成功', icon: 'success' });
  } catch (error: any) {
    uni.hideLoading();
    uni.showToast({ title: error.error || '保存失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

onShow(() => {
  loadSettings();
});
</script>

<style lang="scss" scoped>
.settings-container {
  min-height: 100vh;
  padding: 20rpx;
  background: #f5f5f5;
}

.header {
  margin-bottom: 20rpx;

  .title {
    display: block;
    font-size: 40rpx;
    font-weight: bold;
    color: #333;
  }
}

.section {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;

  .section-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 20rpx;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20rpx 0;
    border-bottom: 1rpx solid #f0f0f0;

    &:last-child {
      border-bottom: none;
    }

    .setting-label {
      flex: 1;

      .label-text {
        display: block;
        font-size: 30rpx;
        font-weight: bold;
        color: #333;
        margin-bottom: 8rpx;
      }

      .label-desc {
        display: block;
        font-size: 24rpx;
        color: #9ca3af;
      }
    }

    .setting-value {
      .time-picker {
        display: flex;
        align-items: center;
        padding: 16rpx 24rpx;
        background: #f9fafb;
        border-radius: 8rpx;

        text {
          font-size: 28rpx;
          color: #333;
        }

        .picker-arrow {
          margin-left: 12rpx;
          font-size: 40rpx;
          color: #d1d5db;
        }
      }
    }
  }
}

.actions {
  padding: 20rpx 0;

  .btn-save {
    width: 100%;
    padding: 32rpx;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    font-size: 32rpx;
    font-weight: bold;
    border-radius: 16rpx;
    border: none;

    &:active {
      opacity: 0.8;
    }
  }
}
</style>
