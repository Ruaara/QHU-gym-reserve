<template>
  <view class="time-container">
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

    <!-- 时间段列表 -->
    <view v-if="loading" class="loading">
      <text>加载中...</text>
    </view>
    <view v-else-if="timeSlots.length === 0" class="empty-state">
      <text class="empty-text">该日期暂无可预约时间段</text>
    </view>
    <view v-else class="time-slots" :class="{ 'has-reserved-slot': !!reservedSlotId }">
      <view
        v-for="slot in timeSlots"
        :key="slot.id"
        class="time-slot"
        :class="{
          'slot-full': slot.availableSlots === 0,
          'slot-club-only': slot.isClubOnly,
          'slot-reserved': slot.id === reservedSlotId
        }"
        @click="selectTimeSlot(slot)"
      >
        <view class="slot-info">
          <text class="slot-time">{{ slot.startTime }} - {{ slot.endTime }}</text>
          <view class="slot-badges">
            <text v-if="slot.isClubOnly" class="badge badge-club">社团专属</text>
            <text class="badge badge-capacity">{{ slot.availableSlots }}/{{ slot.maxCapacity }}</text>
          </view>
        </view>
        <text v-if="slot.id === reservedSlotId" class="slot-reserved-text">已预约</text>
        <text v-else class="slot-arrow">›</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { getTimeSlots, createReservation, getMyReservations } from '@/api';
import { useUserStore } from '@/store/user';
import type { TimeSlot } from '@/types';

const userStore = useUserStore();

const gymId = ref(0);
const gymName = ref('');

const selectedDate = ref('');
const timeSlots = ref<TimeSlot[]>([]);
const loading = ref(true);
const reservedSlotId = ref<number | null>(null);

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

// 加载用户的预约状态
const loadUserReservation = async () => {
  try {
    const res = await getMyReservations(selectedDate.value);
    // 找到这个健身房在这个日期的预约
    const reservation = res.reservations.find(
      (r: any) => r.reservation_date === selectedDate.value
    );
    reservedSlotId.value = reservation ? reservation.time_slot_id : null;
  } catch (error) {
    console.error('加载用户预约状态失败', error);
  }
};

// 加载时间段
const loadTimeSlots = async () => {
  try {
    loading.value = true;
    const res = await getTimeSlots(gymId.value, selectedDate.value);
    timeSlots.value = res.timeSlots;
    // 同时加载用户的预约状态
    await loadUserReservation();
  } catch (error) {
    uni.showToast({ title: '加载时间段失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

// 选择日期
const selectDate = (date: string) => {
  selectedDate.value = date;
  loadTimeSlots();
};

// 选择时间段并预约
const selectTimeSlot = async (slot: TimeSlot) => {
  // 如果已经预约了这个时间段，不允许重复点击
  if (slot.id === reservedSlotId.value) {
    return;
  }

  if (slot.availableSlots === 0) {
    uni.showToast({ title: '该时间段名额已满', icon: 'none' });
    return;
  }

  if (slot.isClubOnly && !userStore.isClub) {
    uni.showToast({ title: '该时间段仅限社团成员预约', icon: 'none' });
    return;
  }

  uni.showModal({
    title: '确认预约',
    content: `确定要预约 ${gymName.value} 的 ${slot.startTime}-${slot.endTime} 吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '预约中...' });

          await createReservation({
            gymId: gymId.value,
            timeSlotId: slot.id,
            reservationDate: selectedDate.value
          });

          // 更新已预约的时间段ID
          reservedSlotId.value = slot.id;

          uni.hideLoading();
          uni.showToast({ title: '预约成功', icon: 'success' });

          setTimeout(() => {
            uni.navigateBack();
          }, 1500);
        } catch (error: any) {
          uni.hideLoading();
          uni.showToast({ title: error.error || '预约失败', icon: 'none' });
        }
      }
    }
  });
};

onShow(() => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1] as any;
  const options = currentPage.options;

  gymId.value = parseInt(options.gymId);
  gymName.value = decodeURIComponent(options.gymName);

  // 默认选择今天
  selectedDate.value = dates.value[0].value;
  loadTimeSlots();
});
</script>

<style lang="scss" scoped>
.time-container {
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
  justify-content: center;
  align-items: center;
  height: 50vh;
  font-size: 28rpx;

  .empty-text {
    color: #9ca3af;
  }
}

.time-slots {
  padding: 20rpx;

  // 当有已预约的时间段时，其他时间段透明度变为70%
  &.has-reserved-slot {
    .time-slot:not(.slot-reserved):not(.slot-full) {
      opacity: 0.7;
    }
  }

  .time-slot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #fff;
    border-radius: 16rpx;
    padding: 32rpx;
    margin-bottom: 16rpx;

    &.slot-full {
      opacity: 0.5;

      .slot-time {
        color: #9ca3af !important;
      }
    }

    // 已预约的时间段样式：蓝色边框
    &.slot-reserved {
      border: 3rpx solid #3b82f6;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);

      .slot-time {
        color: #1d4ed8 !important;
      }

      .slot-reserved-text {
        font-size: 28rpx;
        font-weight: bold;
        color: #3b82f6;
        white-space: nowrap;
      }
    }

    .slot-info {
      flex: 1;

      .slot-time {
        display: block;
        font-size: 32rpx;
        font-weight: bold;
        color: #333;
        margin-bottom: 12rpx;
      }

      .slot-badges {
        display: flex;
        gap: 12rpx;

        .badge {
          padding: 6rpx 16rpx;
          font-size: 22rpx;
          border-radius: 8rpx;

          &.badge-club {
            background: #fef3c7;
            color: #d97706;
          }

          &.badge-capacity {
            background: #dbeafe;
            color: #2563eb;
          }
        }
      }
    }

    .slot-arrow {
      font-size: 56rpx;
      color: #d1d5db;
    }
  }
}
</style>
