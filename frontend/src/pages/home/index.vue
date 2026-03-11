<template>
  <view class="home-container">
    <!-- 公告轮播 -->
    <AnnouncementSlider />

    <!-- 用户信息卡片 -->
    <view class="user-card" @click="goToProfile">
      <view class="user-info">
        <text class="user-name">{{ userStore.user?.name }}</text>
        <text class="user-account">学号：{{ userStore.user?.account }}</text>
      </view>
      <view class="user-actions">
        <button class="btn-mini btn-primary" @click.stop="handleLogout">退出登录</button>
      </view>
    </view>

    <!-- 预约入口 -->
    <view class="section">
      <view class="section-title">快速预约</view>
      <view class="reserve-buttons">
        <button class="reserve-btn" @click="goToReserve">
          <text class="reserve-btn-icon">🏋️</text>
          <text class="reserve-btn-text">立即预约</text>
          <text class="reserve-btn-arrow">›</text>
        </button>
        <button
          class="free-reserve-btn"
          :class="{ 'has-count': freeReserveCount > 0, 'no-count': freeReserveCount === 0 }"
          @click="goToFreeReserve"
        >
          <text class="free-reserve-icon">⭐</text>
          <text class="free-reserve-text">免预约 ({{ freeReserveCount }})</text>
          <text class="free-reserve-arrow">›</text>
        </button>
      </view>
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
          :class="{ 'reservation-used': reservation.isUsed }"
        >
          <view class="reservation-info">
            <text class="reservation-gym">{{ reservation.gymName }}</text>
            <text class="reservation-date">{{ formatReservationDate(reservation.reservationDate) }}</text>
            <text class="reservation-time">{{ reservation.startTime }} - {{ reservation.endTime }}</text>
          </view>
          <view class="reservation-actions">
            <button
              v-if="!reservation.isUsed"
              class="btn-qrcode"
              @click.stop="handleViewQrCode(reservation.id)"
            >
              📱 二维码
            </button>
            <button
              v-if="!reservation.isUsed"
              class="btn-change"
              @click.stop="handleChangeReservation(reservation.id)"
            >
              变更预约
            </button>
          </view>
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
        <view class="admin-item" @click="goToAdmin('settings')">
          <text class="admin-icon">⚙️</text>
          <text class="admin-text">系统设置</text>
        </view>
      </view>
    </view>

    <!-- 二维码弹窗 -->
    <view v-if="showQrCodeModal" class="modal-mask" @click="hideQrCodeModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">我的预约二维码</text>
          <text class="modal-close" @click="hideQrCodeModal">×</text>
        </view>
        <view class="modal-body">
          <view v-if="qrCodeReservation" class="qr-info">
            <text class="qr-gym">{{ qrCodeReservation.gymName }}</text>
            <text class="qr-time">{{ qrCodeReservation.date }} {{ qrCodeReservation.startTime }}-{{ qrCodeReservation.endTime }}</text>
          </view>
          <image v-if="qrCodeImage" :src="qrCodeImage" class="qr-code-image" mode="widthFix" />
          <text class="qr-tip">请出示此二维码给管理员核销</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/user';
import { getMyReservations, cancelReservation, getReservationLimitStatus, getSystemSettings, getMyQrCode, getCurrentUser } from '@/api';
import type { Reservation } from '@/types';
import AnnouncementSlider from '@/components/AnnouncementSlider.vue';

const userStore = useUserStore();
const todayReservations = ref<Reservation[]>([]);
const bookingOpenHours = ref(20); // 默认20:00
const bookingOpenMinutes = ref(0);
const showQrCodeModal = ref(false);
const qrCodeImage = ref('');
const qrCodeReservation = ref<any>(null);

// 免预约次数
const freeReserveCount = computed(() => userStore.user?.freeReserveCount || 0);

// 获取今天的日期
const getTodayDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 获取明天的日期
const getTomorrowDate = (): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 检查是否已过预约开放时间
const isAfterBookingOpenTime = (): boolean => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const openMinutes = bookingOpenHours.value * 60 + bookingOpenMinutes.value;
  return totalMinutes >= openMinutes;
};

// 格式化预约日期显示
const formatReservationDate = (dateStr: string): string => {
  const today = getTodayDate();
  const tomorrow = getTomorrowDate();

  if (dateStr === today) {
    return '今天';
  } else if (dateStr === tomorrow) {
    return '明天';
  } else {
    // 手动解析日期字符串，避免时区问题
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      return `${month}/${day}`;
    }
    return dateStr;
  }
};

// 判断是否是今天
const isToday = (dateStr: string): boolean => {
  return dateStr === getTodayDate();
};

// 加载系统设置
const loadSystemSettings = async () => {
  try {
    const res = await getSystemSettings();
    const bookingTimeStr = res.settings['booking_open_time']?.value || '20:00';
    const [hours, minutes] = bookingTimeStr.split(':').map(Number);
    bookingOpenHours.value = hours;
    bookingOpenMinutes.value = minutes;
  } catch (error) {
    console.error('加载系统设置失败', error);
    // 使用默认值 20:00
    bookingOpenHours.value = 20;
    bookingOpenMinutes.value = 0;
  }
};

// 加载今日预约
const loadTodayReservations = async () => {
  try {
    const today = getTodayDate();
    const pastBookingOpenTime = isAfterBookingOpenTime();

    // 加载今天的预约
    const todayRes = await getMyReservations(today);
    const reservations = [...todayRes.reservations];

    // 如果已过预约开放时间，也加载明天的预约
    if (pastBookingOpenTime) {
      const tomorrow = getTomorrowDate();
      const tomorrowRes = await getMyReservations(tomorrow);
      reservations.push(...tomorrowRes.reservations);
    }

    todayReservations.value = reservations;
  } catch (error) {
    console.error('加载今日预约失败', error);
  }
};

// 去预约
const goToReserve = () => {
  uni.navigateTo({ url: '/pages/select-gym/index' });
};

// 免预约
const goToFreeReserve = () => {
  if (freeReserveCount.value > 0) {
    uni.navigateTo({ url: '/pages/select-gym/index?useFreeReserve=true' });
  } else {
    uni.showToast({ title: '免预约次数不足', icon: 'none' });
  }
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

// 跳转到个人中心
const goToProfile = () => {
  uni.navigateTo({ url: '/pages/profile/index' });
};

// 查看二维码
const handleViewQrCode = async (reservationId: number) => {
  try {
    uni.showLoading({ title: '加载中...' });

    const res = await getMyQrCode();
    qrCodeReservation.value = res.reservation;
    qrCodeImage.value = res.qrCodeImage;

    uni.hideLoading();
    showQrCodeModal.value = true;
  } catch (error: any) {
    uni.hideLoading();
    uni.showToast({
      title: error.error || '加载二维码失败',
      icon: 'none'
    });
  }
};

// 关闭二维码弹窗
const hideQrCodeModal = () => {
  showQrCodeModal.value = false;
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

onShow(async () => {
  // 检查用户是否已登录
  if (!userStore.isLoggedIn) {
    uni.reLaunch({ url: '/pages/login/index' });
    return;
  }

  // 刷新用户信息（以获取最新的免预约次数）
  try {
    const user = await getCurrentUser();
    userStore.setUser(user);
  } catch (error) {
    console.error('刷新用户信息失败', error);
  }

  await loadSystemSettings();
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
  cursor: pointer;
  transition: opacity 0.3s;

  &:active {
    opacity: 0.8;
  }

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

.reserve-buttons {
  display: flex;
  gap: 16rpx;
}

.reserve-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16rpx;
  padding: 32rpx 24rpx;
  border: none;

  &-icon {
    font-size: 48rpx;
  }

  &-text {
    flex: 1;
    font-size: 30rpx;
    color: #fff;
    font-weight: bold;
    margin-left: 16rpx;
  }

  &-arrow {
    font-size: 48rpx;
    color: rgba(255, 255, 255, 0.6);
  }
}

.free-reserve-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 16rpx;
  padding: 32rpx 24rpx;
  border: none;

  &.has-count {
    background: #dc2626;
  }

  &.no-count {
    background: #9ca3af;
  }

  .free-reserve-icon {
    font-size: 48rpx;
  }

  .free-reserve-text {
    flex: 1;
    font-size: 30rpx;
    font-weight: bold;
    margin-left: 16rpx;
    color: #fff;
  }

  .free-reserve-arrow {
    font-size: 48rpx;
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

    // 已使用/核销的预约样式
    &.reservation-used {
      opacity: 0.5;

      .reservation-gym {
        color: #9ca3af !important;
      }

      .reservation-date,
      .reservation-time {
        color: #9ca3af !important;
      }
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

      .reservation-date {
        display: block;
        font-size: 24rpx;
        color: #6b7280;
        margin-bottom: 4rpx;
      }

      .reservation-time {
        display: block;
        font-size: 26rpx;
        color: #6b7280;
      }
    }

    .reservation-actions {
      display: flex;
      gap: 12rpx;
    }

    .btn-qrcode {
      padding: 12rpx 20rpx;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #fff;
      font-size: 24rpx;
      border-radius: 8rpx;
      border: none;
      white-space: nowrap;
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

// 二维码弹窗样式
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx;
  width: 80%;
  max-width: 600rpx;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32rpx;

  .modal-title {
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
  }

  .modal-close {
    font-size: 56rpx;
    color: #9ca3af;
    cursor: pointer;
  }
}

.modal-body {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.qr-info {
  text-align: center;
  margin-bottom: 32rpx;

  .qr-gym {
    display: block;
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 12rpx;
  }

  .qr-time {
    display: block;
    font-size: 26rpx;
    color: #6b7280;
  }
}

.qr-code-image {
  width: 500rpx;
  height: 500rpx;
  margin-bottom: 24rpx;
}

.qr-tip {
  font-size: 24rpx;
  color: #9ca3af;
  text-align: center;
}

.admin-section {
  .admin-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
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
