<template>
  <view class="reservations-container">
    <!-- 日期选择 -->
    <view class="date-selector">
      <scroll-view scroll-x class="date-scroll">
        <view
          v-for="date in dates"
          :key="date.value"
          class="date-item"
          :class="{ active: selectedDate === date.value }"
          @click="selectDate(date.value)"
        >
          <text class="date-day">{{ date.day }}</text>
          <text class="date-date">{{ date.date }}</text>
        </view>
      </scroll-view>
    </view>

    <!-- 预约列表 -->
    <view v-if="loading" class="loading">
      <text>加载中...</text>
    </view>
    <view v-else-if="reservations.length === 0" class="empty-state">
      <text class="empty-icon">📅</text>
      <text class="empty-text">该日期暂无预约记录</text>
    </view>
    <view v-else class="reservation-list">
      <view
        v-for="reservation in reservations"
        :key="reservation.id"
        class="reservation-card"
      >
        <view class="reservation-header">
          <text class="gym-name">{{ reservation.gymName }}</text>
          <text class="reservation-status">已预约</text>
        </view>
        <view class="reservation-body">
          <view class="reservation-time">
            <text class="time-label">时间：</text>
            <text class="time-value">{{ reservation.startTime }} - {{ reservation.endTime }}</text>
          </view>
          <view class="reservation-date">
            <text class="date-label">日期：</text>
            <text class="date-value">{{ reservation.reservationDate }}</text>
          </view>
        </view>
        <view class="reservation-footer">
          <button class="btn-cancel" @click="cancelReservation(reservation.id)">
            取消预约
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { getMyReservations, cancelReservation as cancelReservationApi } from '@/api';
import type { Reservation } from '@/types';

const selectedDate = ref('');
const reservations = ref<Reservation[]>([]);
const loading = ref(true);

// 生成日期列表（未来7天）
const dates = computed(() => {
  const dates = [];
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const value = `${year}-${month}-${day}`;

    dates.push({
      value,
      day: i === 0 ? '今天' : weekDays[date.getDay()],
      date: `${month}/${day}`
    });
  }

  return dates;
});

// 加载预约记录
const loadReservations = async () => {
  try {
    loading.value = true;
    const res = await getMyReservations(selectedDate.value);
    reservations.value = res.reservations;
  } catch (error) {
    uni.showToast({ title: '加载预约记录失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

// 选择日期
const selectDate = (date: string) => {
  selectedDate.value = date;
  loadReservations();
};

// 取消预约
const cancelReservation = (id: number) => {
  uni.showModal({
    title: '确认取消',
    content: '确定要取消该预约吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '取消中...' });

          await cancelReservationApi(id);

          uni.hideLoading();
          uni.showToast({ title: '取消成功', icon: 'success' });

          // 重新加载预约记录
          loadReservations();
        } catch (error: any) {
          uni.hideLoading();
          uni.showToast({ title: error.error || '取消失败', icon: 'none' });
        }
      }
    }
  });
};

onMounted(() => {
  // 默认选择今天
  selectedDate.value = dates.value[0].value;
  loadReservations();
});
</script>

<style lang="scss" scoped>
.reservations-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.date-selector {
  background: #fff;
  padding: 20rpx 0;
  margin-bottom: 20rpx;

  .date-scroll {
    white-space: nowrap;

    .date-item {
      display: inline-block;
      text-align: center;
      padding: 16rpx 32rpx;
      margin: 0 8rpx;
      border-radius: 12rpx;
      background: #f9fafb;

      &.active {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

        .date-day,
        .date-date {
          color: #fff;
        }
      }

      .date-day {
        display: block;
        font-size: 26rpx;
        color: #6b7280;
        margin-bottom: 4rpx;
      }

      .date-date {
        display: block;
        font-size: 24rpx;
        color: #9ca3af;
      }
    }
  }
}

.loading,
.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 50vh;
  gap: 16rpx;

  .empty-icon {
    font-size: 96rpx;
  }

  .empty-text {
    font-size: 28rpx;
    color: #9ca3af;
  }
}

.reservation-list {
  padding: 20rpx;

  .reservation-card {
    background: #fff;
    border-radius: 16rpx;
    padding: 24rpx;
    margin-bottom: 20rpx;

    &:last-child {
      margin-bottom: 0;
    }

    .reservation-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20rpx;
      border-bottom: 2rpx solid #f3f4f6;
      margin-bottom: 20rpx;

      .gym-name {
        font-size: 32rpx;
        font-weight: bold;
        color: #333;
      }

      .reservation-status {
        padding: 8rpx 20rpx;
        background: #d1fae5;
        color: #059669;
        font-size: 24rpx;
        border-radius: 8rpx;
      }
    }

    .reservation-body {
      margin-bottom: 20rpx;

      .reservation-time,
      .reservation-date {
        display: flex;
        font-size: 28rpx;
        margin-bottom: 12rpx;

        &:last-child {
          margin-bottom: 0;
        }

        .time-label,
        .date-label {
          color: #6b7280;
          min-width: 100rpx;
        }

        .time-value,
        .date-value {
          color: #333;
          font-weight: 500;
        }
      }
    }

    .reservation-footer {
      display: flex;
      justify-content: flex-end;

      .btn-cancel {
        padding: 16rpx 40rpx;
        background: #fee2e2;
        color: #dc2626;
        font-size: 26rpx;
        border-radius: 8rpx;
        border: none;
      }
    }
  }
}
</style>
