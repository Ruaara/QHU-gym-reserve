<template>
  <view class="time-container">
    <!-- 日期选择 -->
    <view class="date-selector">
      <scroll-view scroll-x class="date-scroll">
        <view
          v-for="date in dates"
          :key="date.value"
          class="date-item"
          :class="{ active: selectedDate === date.value, 'date-disabled': !date.canReserve }"
          @click="date.canReserve ? selectDate(date.value) : null"
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
    <view v-else class="time-slots-container">
      <!-- 社团专属时间段区域 -->
      <view v-if="clubOnlySlots.length > 0" class="slot-type-section">
        <view class="slot-type-header type-club">
          <text class="type-title">🏆 社团专属</text>
          <text class="type-count">{{ clubOnlySlots.length }} 个</text>
        </view>
        <view class="slots-list">
          <view
            v-for="slot in clubOnlySlots"
            :key="slot.id"
            class="time-slot"
            :class="{
              'slot-full': slot.availableSlots === 0,
              'slot-reserved': slot.userReserved,
              'slot-disabled': isSlotDisabled(slot),
              'slot-dimmed': isSlotDimmed(slot)
            }"
            @click="isSlotDisabled(slot) ? null : selectTimeSlot(slot)"
          >
            <view class="slot-info">
              <text class="slot-time">{{ slot.startTime }} - {{ slot.endTime }}</text>
              <text class="badge badge-club-mini">社团专属</text>
              <text class="badge badge-capacity">{{ slot.availableSlots }}/{{ slot.maxCapacity }}</text>
            </view>
            <view class="slot-status">
              <text v-if="slot.isUsed" class="slot-used-text">已经核销</text>
              <text v-else-if="slot.userReserved" class="slot-reserved-text">已预约</text>
              <text v-else class="slot-arrow">›</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 普通时间段区域 -->
      <view v-if="regularSlots.length > 0" class="slot-type-section">
        <view class="slot-type-header type-regular">
          <text class="type-title">💪 普通预约</text>
          <text class="type-count">{{ regularSlots.length }} 个</text>
        </view>
        <view class="slots-list">
          <view
            v-for="slot in regularSlots"
            :key="slot.id"
            class="time-slot"
            :class="{
              'slot-full': slot.availableSlots === 0,
              'slot-reserved': slot.userReserved,
              'slot-disabled': isSlotDisabled(slot),
              'slot-dimmed': isSlotDimmed(slot)
            }"
            @click="isSlotDisabled(slot) ? null : selectTimeSlot(slot)"
          >
            <view class="slot-info">
              <text class="slot-time">{{ slot.startTime }} - {{ slot.endTime }}</text>
              <text class="badge badge-regular-mini">普通预约</text>
              <text class="badge badge-capacity">{{ slot.availableSlots }}/{{ slot.maxCapacity }}</text>
            </view>
            <view class="slot-status">
              <text v-if="slot.isUsed" class="slot-used-text">已经核销</text>
              <text v-else-if="slot.userReserved" class="slot-reserved-text">已预约</text>
              <text v-else class="slot-arrow">›</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { getTimeSlots, createReservation, getMyReservations, checkDateAvailability, getReservationLimitStatus, getSystemSettings } from '@/api';
import { useUserStore } from '@/store/user';
import type { TimeSlot } from '@/types';

interface DateItem {
  value: string;
  day: string;
  date: string;
  canReserve: boolean;
}

const userStore = useUserStore();

const gymId = ref(0);
const gymName = ref('');

const selectedDate = ref('');
const timeSlots = ref<TimeSlot[]>([]);
const loading = ref(true);
const reservedSlotId = ref<number | null>(null);
const todayReserved = ref(false);
const hasReservedToday = ref(false); // 新增：追踪用户今天是否有预约记录
const dateAvailability = ref<Record<string, boolean>>({});
const bookingOpenHours = ref(20); // 默认20:00
const bookingOpenMinutes = ref(0);
const useFreeReserve = ref(false); // 是否使用免预约

// 分组时间段：社团专属和普通
const clubOnlySlots = computed(() => {
  return timeSlots.value.filter(slot => slot.isClubOnly);
});

const regularSlots = computed(() => {
  return timeSlots.value.filter(slot => !slot.isClubOnly);
});

// 获取今天的日期
const getTodayDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
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

// 生成日期列表（未来7天）
const dates = computed<DateItem[]>(() => {
  const dates: DateItem[] = [];
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const past8PM = isAfterBookingOpenTime();

  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const value = `${year}-${month}-${day}`;

    // 检查日期是否可预约
    let canReserve = dateAvailability.value[value] ?? false;

    // 如果是今天且已过晚上8点，禁止预约
    if (i === 0 && past8PM) {
      canReserve = false;
    }

    dates.push({
      value,
      day: i === 0 ? '今天' : weekDays[date.getDay()],
      date: `${month}/${day}`,
      canReserve
    });
  }

  return dates;
});

// 检查所有日期的可用性
const checkAllDatesAvailability = async () => {
  const today = new Date();
  const availability: Record<string, boolean> = {};

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // 今天的日期总是可以预约
    if (i === 0) {
      availability[dateStr] = true;
    } else {
      try {
        const res = await checkDateAvailability(dateStr);
        availability[dateStr] = res.canReserve;
      } catch (error) {
        availability[dateStr] = false;
      }
    }
  }

  dateAvailability.value = availability;
};

// 加载用户的预约状态和限制状态
const loadUserStatus = async () => {
  try {
    const [res, limitRes, todayRes] = await Promise.all([
      getMyReservations(selectedDate.value),
      getReservationLimitStatus(),
      getMyReservations(new Date().toISOString().split('T')[0]) // 获取今天的预约
    ]);

    // 找到这个健身房在这个日期的预约
    const reservation = res.reservations.find(
      (r: any) => r.reservation_date === selectedDate.value
    );
    reservedSlotId.value = reservation ? reservation.time_slot_id : null;

    // 更新今日预约状态
    todayReserved.value = limitRes.today_reserved;

    // 检查用户今天是否有预约记录（用于变暗效果）
    hasReservedToday.value = todayRes.reservations.length > 0;
  } catch (error) {
    console.error('加载用户状态失败', error);
  }
};

// 加载时间段
const loadTimeSlots = async () => {
  try {
    loading.value = true;
    const res = await getTimeSlots(gymId.value, selectedDate.value);
    timeSlots.value = res.timeSlots;
    // 同时加载用户的预约状态
    await loadUserStatus();
  } catch (error) {
    uni.showToast({ title: '加载时间段失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

// 判断时间段是否禁用
const isSlotDisabled = (slot: TimeSlot): boolean => {
  // 如果已核销，禁用（优先检查）
  if (slot.isUsed) {
    return true;
  }

  // 如果使用免预约，满员的时间段也可以点击
  if (useFreeReserve.value && slot.availableSlots === 0) {
    return false;
  }

  // 如果名额已满且不使用免预约，禁用
  if (slot.availableSlots === 0) {
    return true;
  }

  // 如果已预约此时间段但未核销，不禁用（可以查看）
  if (slot.userReserved) {
    return false;
  }

  // 如果使用免预约，不受每日预约限制
  if (!useFreeReserve.value) {
    // 如果今天是今天且已预约，禁用其他时间段
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (selectedDate.value === todayStr && todayReserved.value) {
      return true;
    }
  }

  // 如果已过晚上8点且选择的是今天，禁用所有时间段
  if (isAfterBookingOpenTime() && selectedDate.value === getTodayDate()) {
    return true;
  }

  return false;
};

// 判断时间段是否应该变暗（40%透明度）
const isSlotDimmed = (slot: TimeSlot): boolean => {
  // 如果已预约此时间段，不变暗
  if (slot.userReserved) {
    return false;
  }

  // 如果用户今天有预约记录（不管今天是否已预约，只要今天有预约就限制其他日期）
  if (hasReservedToday.value) {
    // 获取今天的日期
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // 如果选择的不是今天，所有时段都应该变暗（因为今天已预约，不能再预约其他日期）
    if (selectedDate.value !== todayStr) {
      return true;
    }

    // 如果选择的是今天，不是已预约的时段就变暗
    return true;
  }

  return false;
};

// 选择日期
const selectDate = (date: string) => {
  selectedDate.value = date;
  loadTimeSlots();
};

// 选择时间段并预约
const selectTimeSlot = async (slot: TimeSlot) => {
  // 如果已经预约了这个时间段，不允许重复点击
  if (slot.userReserved) {
    return;
  }

  // 如果不使用免预约且名额已满，提示
  if (!useFreeReserve.value && slot.availableSlots === 0) {
    uni.showToast({ title: '该时间段名额已满', icon: 'none' });
    return;
  }

  if (slot.isClubOnly && !userStore.isClub) {
    uni.showToast({ title: '该时间段仅限社团成员预约', icon: 'none' });
    return;
  }

  // 如果使用免预约，显示确认提示
  if (useFreeReserve.value) {
    const freeReserveCount = userStore.user?.freeReserveCount || 0;
    const confirmMsg = slot.availableSlots === 0
      ? `该时间段已满员，确定使用1次免预约机会预约 ${gymName.value} 的 ${slot.startTime}-${slot.endTime} 吗？\n\n剩余免预约次数：${freeReserveCount - 1}`
      : `确定使用1次免预约机会预约 ${gymName.value} 的 ${slot.startTime}-${slot.endTime} 吗？\n\n剩余免预约次数：${freeReserveCount - 1}`;

    uni.showModal({
      title: '使用免预约',
      content: confirmMsg,
      success: async (res) => {
        if (res.confirm) {
          await performReservation(slot);
        }
      }
    });
  } else {
    // 普通预约确认
    uni.showModal({
      title: '确认预约',
      content: `确定要预约 ${gymName.value} 的 ${slot.startTime}-${slot.endTime} 吗？`,
      success: async (res) => {
        if (res.confirm) {
          await performReservation(slot);
        }
      }
    });
  }
};

// 执行预约
const performReservation = async (slot: TimeSlot) => {
  try {
    uni.showLoading({ title: '预约中...' });

    await createReservation({
      gymId: gymId.value,
      timeSlotId: slot.id,
      reservationDate: selectedDate.value,
      useFreeReserve: useFreeReserve.value
    });

    // 更新已预约的时间段ID
    reservedSlotId.value = slot.id;
    if (!useFreeReserve.value) {
      todayReserved.value = true;
    }

    uni.hideLoading();
    uni.showToast({ title: '预约成功', icon: 'success' });

    setTimeout(() => {
      uni.navigateBack();
    }, 1500);
  } catch (error: any) {
    uni.hideLoading();
    uni.showToast({ title: error.error || '预约失败', icon: 'none' });
  }
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

onShow(async () => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1] as any;
  const options = currentPage.options;

  gymId.value = parseInt(options.gymId);
  gymName.value = decodeURIComponent(options.gymName);
  useFreeReserve.value = options.useFreeReserve === 'true';

  // 加载系统设置
  await loadSystemSettings();

  // 检查所有日期的可用性
  await checkAllDatesAvailability();

  // 如果已过预约开放时间，默认选择明天
  if (isAfterBookingOpenTime() && dates.value.length > 1) {
    selectedDate.value = dates.value[1].value;
  } else {
    // 否则选择今天
    selectedDate.value = dates.value[0].value;
  }

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
      transition: opacity 0.3s;

      &.date-disabled {
        opacity: 0.5;
        pointer-events: none;
      }

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

.time-slots-container {
  padding: 20rpx;
  padding-bottom: 40rpx;

  .slot-type-section {
    margin-bottom: 32rpx;

    .slot-type-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20rpx 24rpx;
      border-radius: 12rpx;
      margin-bottom: 16rpx;

      .type-title {
        font-size: 30rpx;
        font-weight: bold;
      }

      .type-count {
        font-size: 24rpx;
        opacity: 0.8;
      }

      &.type-club {
        background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
        color: #fff;
      }

      &.type-regular {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: #fff;
      }
    }

    .slots-list {
      .time-slot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #fff;
        border-radius: 16rpx;
        padding: 32rpx;
        margin-bottom: 16rpx;
        transition: all 0.3s;

        &.slot-full,
        &.slot-disabled {
          opacity: 0.4;
          pointer-events: none;

          .slot-time {
            color: #9ca3af !important;
          }
        }

        &.slot-dimmed {
          opacity: 0.4;
          pointer-events: none;
        }

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

          .slot-used-text {
            font-size: 28rpx;
            font-weight: bold;
            color: #9ca3af;
            white-space: nowrap;
          }
        }

        .slot-info {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 16rpx;

          .slot-time {
            font-size: 32rpx;
            font-weight: bold;
            color: #333;
          }

          .badge {
            padding: 6rpx 16rpx;
            font-size: 22rpx;
            border-radius: 8rpx;
            font-weight: 500;

            &.badge-club-mini {
              background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
              color: #fff;
              box-shadow: 0 2rpx 8rpx rgba(168, 85, 247, 0.3);
            }

            &.badge-regular-mini {
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
              color: #fff;
              box-shadow: 0 2rpx 8rpx rgba(59, 130, 246, 0.3);
            }

            &.badge-capacity {
              background: #dbeafe;
              color: #2563eb;
            }
          }
        }

        .slot-status {
          display: flex;
          align-items: center;
        }

        .slot-arrow {
          font-size: 56rpx;
          color: #d1d5db;
        }
      }
    }
  }
}
</style>
