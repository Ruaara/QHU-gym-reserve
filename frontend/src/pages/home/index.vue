<template>
  <view class="home-container">
    <!-- 公告轮播 -->
    <AnnouncementSlider />

    <!-- 用户信息卡片 -->
    <view class="user-card">
      <view class="user-info">
        <text class="user-name">{{ userStore.user?.name }}</text>
        <text class="user-account">学号：{{ userStore.user?.account }}</text>
      </view>
      <view class="user-actions">
        <button class="btn-mini btn-primary" @click="handleLogout">退出登录</button>
      </view>
    </view>

    <!-- 预约入口 -->
    <view class="section">
      <view class="section-title">快速预约</view>
      <button class="reserve-btn" @click="goToReserve">
        <text class="reserve-btn-icon">🏋️</text>
        <text class="reserve-btn-text">立即预约健身房</text>
        <text class="reserve-btn-arrow">›</text>
      </button>
    </view>

    <!-- 今日预约 -->
    <view class="section">
      <view class="section-title">今日预约</view>
      <view v-if="todayReservations.length === 0" class="empty-state">
        <text class="empty-text">暂无预约记录</text>
      </view>
      <view v-else class="reservation-list">
        <view
          v-for="reservation in todayReservations"
          :key="reservation.id"
          class="reservation-item"
        >
          <view class="reservation-info">
            <text class="reservation-gym">{{ reservation.gymName }}</text>
            <text class="reservation-time">{{ reservation.startTime }} - {{ reservation.endTime }}</text>
          </view>
          <button class="btn-change" @click.stop="handleChangeReservation(reservation.id)">
            变更预约
          </button>
        </view>
      </view>
    </view>

    <!-- 管理员入口 -->
    <view v-if="userStore.isAdmin" class="section admin-section">
      <view class="section-title">管理功能</view>
      <view class="admin-grid">
        <view class="admin-item" @click="goToAdmin('gyms')">
          <text class="admin-icon">🏢</text>
          <text class="admin-text">健身房管理</text>
        </view>
        <view class="admin-item" @click="goToAdmin('time-slots')">
          <text class="admin-icon">⏰</text>
          <text class="admin-text">时间段管理</text>
        </view>
        <view class="admin-item" @click="goToAdmin('users')">
          <text class="admin-icon">👥</text>
          <text class="admin-text">用户管理</text>
        </view>
        <view class="admin-item" @click="goToAdmin('announcements')">
          <text class="admin-icon">📢</text>
          <text class="admin-text">公告管理</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/user';
import { getMyReservations, cancelReservation, getReservationLimitStatus } from '@/api';
import type { Reservation } from '@/types';
import AnnouncementSlider from '@/components/AnnouncementSlider.vue';

const userStore = useUserStore();
const todayReservations = ref<Reservation[]>([]);

// 获取今天的日期
const getTodayDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 加载今日预约
const loadTodayReservations = async () => {
  try {
    const today = getTodayDate();
    const res = await getMyReservations(today);
    todayReservations.value = res.reservations;
  } catch (error) {
    console.error('加载今日预约失败', error);
  }
};

// 去预约
const goToReserve = () => {
  uni.navigateTo({ url: '/pages/select-gym/index' });
};

// 去管理页面
const goToAdmin = (type: string) => {
  uni.navigateTo({ url: `/pages/admin/${type}/index` });
};

// 变更预约
const handleChangeReservation = async (reservationId: number) => {
  try {
    // 1. 获取今日变更次数
    const limitStatus = await getReservationLimitStatus();

    if (limitStatus.today_change === 0) {
      // 今日更改机会已用尽
      uni.showModal({
        title: '提示',
        content: '今日更改机会已用尽',
        showCancel: false,
        success: () => {}
      });
      return;
    }

    // 2. 询问是否取消预约
    uni.showModal({
      title: '提示',
      content: '是否取消预约？',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 3. 取消预约
            await cancelReservation(reservationId);

            // 4. 询问是否重新预约
            uni.showModal({
              title: '成功',
              content: '您已成功取消预约，是否重新预约其他时间段？',
              success: (res2) => {
                if (res2.confirm) {
                  uni.navigateTo({ url: '/pages/select-gym/index' });
                } else {
                  // 刷新预约列表
                  loadTodayReservations();
                }
              }
            });
          } catch (error: any) {
            uni.showToast({
              title: error.error || '取消预约失败',
              icon: 'none'
            });
          }
        }
      }
    });
  } catch (error) {
    console.error('获取限制状态失败', error);
  }
};

// 退出登录
const handleLogout = () => {
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        userStore.logout();
      }
    }
  });
};

onShow(() => {
  loadTodayReservations();
});
</script>

<style lang="scss" scoped>
.home-container {
  min-height: 100vh;
  padding: 20rpx;
  background: #f5f5f5;
}

.user-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16rpx;
  padding: 32rpx;
  margin-bottom: 20rpx;

  .user-info {
    .user-name {
      display: block;
      font-size: 36rpx;
      font-weight: bold;
      color: #fff;
      margin-bottom: 8rpx;
    }

    .user-account {
      display: block;
      font-size: 26rpx;
      color: rgba(255, 255, 255, 0.8);
    }
  }

  .btn-mini {
    padding: 16rpx 32rpx;
    font-size: 26rpx;
    border-radius: 8rpx;
    border: none;

    &.btn-primary {
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
    }
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
}

.reserve-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16rpx;
  padding: 32rpx;
  border: none;
  width: 100%;

  &-icon {
    font-size: 56rpx;
  }

  &-text {
    flex: 1;
    font-size: 32rpx;
    color: #fff;
    font-weight: bold;
    margin-left: 24rpx;
  }

  &-arrow {
    font-size: 56rpx;
    color: rgba(255, 255, 255, 0.6);
  }
}

.empty-state {
  text-align: center;
  padding: 60rpx 0;

  .empty-text {
    font-size: 28rpx;
    color: #9ca3af;
  }
}

.reservation-list {
  .reservation-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f9fafb;
    border-radius: 12rpx;
    padding: 24rpx;
    margin-bottom: 16rpx;

    &:last-child {
      margin-bottom: 0;
    }

    .reservation-info {
      flex: 1;

      .reservation-gym {
        display: block;
        font-size: 30rpx;
        font-weight: bold;
        color: #333;
        margin-bottom: 8rpx;
      }

      .reservation-time {
        display: block;
        font-size: 26rpx;
        color: #6b7280;
      }
    }

    .btn-change {
      padding: 12rpx 24rpx;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      font-size: 24rpx;
      border-radius: 8rpx;
      border: none;
      white-space: nowrap;
    }
  }
}

.admin-section {
  .admin-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16rpx;
  }

  .admin-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #f9fafb;
    border-radius: 12rpx;
    padding: 32rpx 16rpx;

    .admin-icon {
      font-size: 56rpx;
      margin-bottom: 12rpx;
    }

    .admin-text {
      font-size: 26rpx;
      color: #333;
      text-align: center;
    }
  }
}
</style>
