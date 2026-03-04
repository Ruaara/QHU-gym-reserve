<template>
  <view class="admin-slots-container">
    <!-- 操作按钮区域 -->
    <view class="actions-section">
      <button class="btn-add" @click="openAddModal">
        <text class="add-icon">+</text>
        <text>添加时间段</text>
      </button>
      <button class="btn-set-time" @click="openBookingTimeModal">
        <text class="time-icon">⏰</text>
        <text>更改预约开放时间</text>
      </button>
    </view>

    <!-- 时间段列表 - 按健身房分组 -->
    <view v-if="loading" class="loading">
      <text>加载中...</text>
    </view>
    <view v-else-if="Object.keys(groupedSlots).length === 0" class="empty-state">
      <text class="empty-text">暂无时间段</text>
    </view>
    <view v-else class="gyms-list">
      <view
        v-for="([gymId, gymData], index) in Object.entries(groupedSlots)"
        :key="gymId"
        class="gym-section"
      >
        <!-- 健身房标题 -->
        <view class="gym-header">
          <text class="gym-name">{{ gymData.gymName }}</text>
          <text class="slot-count">{{ gymData.clubOnly.length + gymData.regular.length }} 个时间段</text>
        </view>

        <!-- 社团时间段区域 -->
        <view v-if="gymData.clubOnly.length > 0" class="type-section">
          <view class="type-header type-club">
            <text class="type-title">社团专属</text>
            <text class="type-count">{{ gymData.clubOnly.length }} 个</text>
          </view>
          <view class="slots-list">
            <view
              v-for="slot in gymData.clubOnly"
              :key="slot.id"
              class="slot-card"
            >
              <view class="slot-header">
                <view class="time-info">
                  <text class="time-text">{{ slot.startTime }} - {{ slot.endTime }}</text>
                  <view class="badges">
                    <text v-if="!slot.isActive" class="badge badge-inactive">已停用</text>
                  </view>
                </view>
                <view class="slot-details">
                  <text class="detail-text">名额: {{ slot.maxCapacity }}人</text>
                  <text class="detail-text">开放: {{ formatDays(slot.daysAvailable) }}</text>
                  <text class="detail-text">预约: {{ slot.bookingOpenTime }}开放</text>
                </view>
              </view>
              <view class="slot-actions">
                <button class="btn-mini btn-edit" @click="editSlot(slot)">编辑</button>
                <button class="btn-mini btn-delete" @click="deleteSlot(slot.id)">删除</button>
              </view>
            </view>
          </view>
        </view>

        <!-- 非社团时间段区域 -->
        <view v-if="gymData.regular.length > 0" class="type-section">
          <view class="type-header type-regular">
            <text class="type-title">普通预约</text>
            <text class="type-count">{{ gymData.regular.length }} 个</text>
          </view>
          <view class="slots-list">
            <view
              v-for="slot in gymData.regular"
              :key="slot.id"
              class="slot-card"
            >
              <view class="slot-header">
                <view class="time-info">
                  <text class="time-text">{{ slot.startTime }} - {{ slot.endTime }}</text>
                  <view class="badges">
                    <text v-if="!slot.isActive" class="badge badge-inactive">已停用</text>
                  </view>
                </view>
                <view class="slot-details">
                  <text class="detail-text">名额: {{ slot.maxCapacity }}人</text>
                  <text class="detail-text">开放: {{ formatDays(slot.daysAvailable) }}</text>
                  <text class="detail-text">预约: {{ slot.bookingOpenTime }}开放</text>
                </view>
              </view>
              <view class="slot-actions">
                <button class="btn-mini btn-edit" @click="editSlot(slot)">编辑</button>
                <button class="btn-mini btn-delete" @click="deleteSlot(slot.id)">删除</button>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 添加/编辑时间段弹窗 -->
    <view v-if="showSlotModal" class="modal-overlay" @click="closeSlotModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ isEditMode ? '编辑时间段' : '添加时间段' }}</text>
          <text class="modal-close" @click="closeSlotModal">×</text>
        </view>
        <view class="modal-body">
          <view class="form-item">
            <text class="label">健身房</text>
            <picker mode="selector" :range="gyms" range-key="name" :value="gymIndex" @change="onGymChange">
              <view class="picker">
                {{ formData.gymName || '请选择健身房' }}
              </view>
            </picker>
          </view>
          <view class="form-row">
            <view class="form-item half">
              <text class="label">开始时间</text>
              <picker mode="time" :value="formData.startTime" @change="formData.startTime = $event.detail.value">
                <view class="picker">
                  {{ formData.startTime || '请选择开始时间' }}
                </view>
              </picker>
            </view>
            <view class="form-item half">
              <text class="label">结束时间</text>
              <picker mode="time" :value="formData.endTime" @change="formData.endTime = $event.detail.value">
                <view class="picker">
                  {{ formData.endTime || '请选择结束时间' }}
                </view>
              </picker>
            </view>
          </view>
          <view class="form-item">
            <text class="label">最大名额</text>
            <input
              v-model.number="formData.maxCapacity"
              class="input"
              type="number"
              placeholder="请输入最大名额"
            />
          </view>
          <view class="form-item">
            <text class="label">预约类型</text>
            <view class="radio-group">
              <label class="radio-item">
                <radio
                  :checked="!formData.isClubOnly"
                  @click="formData.isClubOnly = false"
                  color="#667eea"
                />
                <text>普通预约</text>
              </label>
              <label class="radio-item">
                <radio
                  :checked="formData.isClubOnly"
                  @click="formData.isClubOnly = true"
                  color="#667eea"
                />
                <text>社团专属</text>
              </label>
            </view>
          </view>
          <view class="form-item">
            <text class="label">可预约星期</text>
            <view class="days-selector">
              <label
                v-for="day in weekDays"
                :key="day.value"
                class="day-checkbox"
                :class="{ checked: formData.daysAvailable.includes(day.value) }"
              >
                <checkbox
                  :checked="formData.daysAvailable.includes(day.value)"
                  @click="toggleDay(day.value)"
                  color="#667eea"
                />
                <text>{{ day.label }}</text>
              </label>
            </view>
          </view>
          <view v-if="isEditMode" class="form-item">
            <text class="label">状态</text>
            <view class="switch-container">
              <switch
                :checked="formData.isActive"
                @change="formData.isActive = $event.detail.value"
                color="#667eea"
              />
              <text class="switch-label">{{ formData.isActive ? '启用' : '停用' }}</text>
            </view>
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn btn-outline" @click="closeSlotModal">取消</button>
          <button class="btn btn-primary" @click="submitSlot">确定</button>
        </view>
      </view>
    </view>

    <!-- 预约开放时间设置弹窗 -->
    <view v-if="showBookingTimeModal" class="modal-overlay" @click="closeBookingTimeModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">更改预约开放时间</text>
          <text class="modal-close" @click="closeBookingTimeModal">×</text>
        </view>
        <view class="modal-body">
          <view class="form-item">
            <text class="label">每天预约开放时间</text>
            <picker mode="time" :value="bookingTimeForm.bookingOpenTime" @change="bookingTimeForm.bookingOpenTime = $event.detail.value">
              <view class="picker">
                {{ bookingTimeForm.bookingOpenTime || '请选择时间' }}
              </view>
            </picker>
          </view>
          <view class="info-text">
            <text>💡 此设置将应用到所有时间段。学生只能在设定时间之后才能预约当天的名额。</text>
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn btn-outline" @click="closeBookingTimeModal">取消</button>
          <button class="btn btn-primary" @click="submitBookingTime">确定</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useUserStore } from '@/store/user';
import {
  adminGetTimeSlots,
  adminAddTimeSlot,
  adminUpdateTimeSlot,
  adminDeleteTimeSlot,
  adminGetGyms,
  adminGetBookingOpenTime,
  adminSetBookingOpenTime
} from '@/api';

const userStore = useUserStore();

interface TimeSlot {
  id: number;
  gymId: number;
  gymName: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  isClubOnly: boolean;
  isActive: boolean;
  daysAvailable: number[];
  bookingOpenTime: string;
}

const weekDays = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
];

const loading = ref(true);
const timeSlots = ref<TimeSlot[]>([]);
const gyms = ref<any[]>([]);

const showSlotModal = ref(false);
const showBookingTimeModal = ref(false);
const isEditMode = ref(false);
const editingId = ref<number | null>(null);
const gymIndex = ref(0);

const formData = ref({
  gymId: 0,
  gymName: '',
  startTime: '',
  endTime: '',
  maxCapacity: 20,
  isClubOnly: false,
  isActive: true,
  daysAvailable: [1, 2, 3, 4, 5, 6, 7],
  bookingOpenTime: '20:00'
});

const bookingTimeForm = ref({
  bookingOpenTime: '20:00'
});

// 按健身房和社团类型两级分组
const groupedSlots = computed(() => {
  const groups: Record<string, { clubOnly: TimeSlot[]; regular: TimeSlot[]; gymName: string }> = {};
  timeSlots.value.forEach(slot => {
    const key = String(slot.gymId);
    if (!groups[key]) {
      groups[key] = { clubOnly: [], regular: [], gymName: slot.gymName };
    }
    if (slot.isClubOnly) {
      groups[key].clubOnly.push(slot);
    } else {
      groups[key].regular.push(slot);
    }
  });
  return groups;
});

// 加载时间段列表
const loadTimeSlots = async () => {
  try {
    loading.value = true;
    const res = await adminGetTimeSlots();
    timeSlots.value = res.timeSlots;
  } catch (error) {
    uni.showToast({ title: '加载时间段列表失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

// 加载健身房列表
const loadGyms = async () => {
  try {
    const res = await adminGetGyms();
    gyms.value = res.gyms;
  } catch (error) {
    console.error('加载健身房列表失败', error);
  }
};

// 加载预约开放时间
const loadBookingOpenTime = async () => {
  try {
    const res = await adminGetBookingOpenTime();
    bookingTimeForm.value.bookingOpenTime = res.bookingOpenTime;
    formData.value.bookingOpenTime = res.bookingOpenTime;
  } catch (error) {
    console.error('加载预约开放时间失败', error);
  }
};

// 健身房选择变化
const onGymChange = (e: any) => {
  const index = e.detail.value;
  gymIndex.value = index;
  formData.value.gymId = gyms.value[index].id;
  formData.value.gymName = gyms.value[index].name;
};

// 切换星期几
const toggleDay = (day: number) => {
  const index = formData.value.daysAvailable.indexOf(day);
  if (index > -1) {
    formData.value.daysAvailable.splice(index, 1);
  } else {
    formData.value.daysAvailable.push(day);
  }
};

// 格式化星期几显示
const formatDays = (days: number[]) => {
  if (!days || days.length === 0) return '未设置';
  if (days.length === 7) return '每天';
  return days.map(d => weekDays.find(w => w.value === d)?.label).join('、');
};

// 打开添加弹窗
const openAddModal = () => {
  isEditMode.value = false;
  editingId.value = null;
  gymIndex.value = 0;
  formData.value = {
    gymId: gyms.value[0]?.id || 0,
    gymName: gyms.value[0]?.name || '',
    startTime: '',
    endTime: '',
    maxCapacity: 20,
    isClubOnly: false,
    isActive: true,
    daysAvailable: [1, 2, 3, 4, 5, 6, 7],
    bookingOpenTime: bookingTimeForm.value.bookingOpenTime
  };
  showSlotModal.value = true;
};

// 编辑时间段
const editSlot = (slot: TimeSlot) => {
  isEditMode.value = true;
  editingId.value = slot.id;
  const index = gyms.value.findIndex(g => g.id === slot.gymId);
  gymIndex.value = index >= 0 ? index : 0;

  formData.value = {
    gymId: slot.gymId,
    gymName: slot.gymName,
    startTime: slot.startTime,
    endTime: slot.endTime,
    maxCapacity: slot.maxCapacity,
    isClubOnly: slot.isClubOnly,
    isActive: slot.isActive,
    daysAvailable: slot.daysAvailable || [1, 2, 3, 4, 5, 6, 7],
    bookingOpenTime: slot.bookingOpenTime || '20:00'
  };
  showSlotModal.value = true;
};

// 删除时间段
const deleteSlot = (id: number) => {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除该时间段吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '删除中...' });
          await adminDeleteTimeSlot(id);
          uni.hideLoading();
          uni.showToast({ title: '删除成功', icon: 'success' });
          loadTimeSlots();
        } catch (error: any) {
          uni.hideLoading();
          uni.showToast({ title: error.error || '删除失败', icon: 'none' });
        }
      }
    }
  });
};

// 提交时间段表单
const submitSlot = async () => {
  const { gymId, startTime, endTime, maxCapacity } = formData.value;

  if (!gymId || !startTime || !endTime || !maxCapacity) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' });
    return;
  }

  if (startTime >= endTime) {
    uni.showToast({ title: '结束时间必须大于开始时间', icon: 'none' });
    return;
  }

  if (formData.value.daysAvailable.length === 0) {
    uni.showToast({ title: '请至少选择一天可预约', icon: 'none' });
    return;
  }

  try {
    uni.showLoading({ title: '提交中...' });

    const data = {
      gymId,
      startTime,
      endTime,
      isClubOnly: formData.value.isClubOnly,
      maxCapacity,
      daysAvailable: formData.value.daysAvailable,
      bookingOpenTime: formData.value.bookingOpenTime
    };

    if (isEditMode.value) {
      await adminUpdateTimeSlot(editingId.value!, { ...data, isActive: formData.value.isActive });
    } else {
      await adminAddTimeSlot(data);
    }

    uni.hideLoading();
    uni.showToast({ title: '操作成功', icon: 'success' });
    closeSlotModal();
    loadTimeSlots();
  } catch (error: any) {
    uni.hideLoading();
    uni.showToast({ title: error.error || '操作失败', icon: 'none' });
  }
};

// 关闭时间段弹窗
const closeSlotModal = () => {
  showSlotModal.value = false;
  isEditMode.value = false;
  editingId.value = null;
};

// 打开预约开放时间弹窗
const openBookingTimeModal = () => {
  bookingTimeForm.value.bookingOpenTime = bookingTimeForm.value.bookingOpenTime || '20:00';
  showBookingTimeModal.value = true;
};

// 关闭预约开放时间弹窗
const closeBookingTimeModal = () => {
  showBookingTimeModal.value = false;
};

// 提交预约开放时间
const submitBookingTime = async () => {
  if (!bookingTimeForm.value.bookingOpenTime) {
    uni.showToast({ title: '请选择预约开放时间', icon: 'none' });
    return;
  }

  try {
    uni.showLoading({ title: '设置中...' });
    await adminSetBookingOpenTime(bookingTimeForm.value.bookingOpenTime);
    uni.hideLoading();
    uni.showToast({ title: '设置成功', icon: 'success' });
    closeBookingTimeModal();
    loadTimeSlots();
  } catch (error: any) {
    uni.hideLoading();
    uni.showToast({ title: error.error || '设置失败', icon: 'none' });
  }
};

onMounted(() => {
  loadTimeSlots();
  loadGyms();
  loadBookingOpenTime();
});
</script>

<style lang="scss" scoped>
.admin-slots-container {
  min-height: 100vh;
  padding: 20rpx;
  background: #f5f5f5;
}

.actions-section {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;

  .btn-add {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12rpx;
    height: 88rpx;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    font-size: 30rpx;
    border-radius: 12rpx;
    border: none;

    .add-icon {
      font-size: 40rpx;
      font-weight: bold;
    }
  }

  .btn-set-time {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12rpx;
    height: 88rpx;
    background: #fef3c7;
    color: #d97706;
    font-size: 28rpx;
    border-radius: 12rpx;
    border: none;

    .time-icon {
      font-size: 32rpx;
    }
  }
}

.loading,
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 40vh;
  font-size: 28rpx;

  .empty-text {
    color: #9ca3af;
  }
}

.gyms-list {
  .gym-section {
    margin-bottom: 32rpx;

    .gym-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16rpx 20rpx;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12rpx 12rpx 0 0;

      .gym-name {
        font-size: 32rpx;
        font-weight: bold;
        color: #fff;
      }

      .slot-count {
        font-size: 24rpx;
        color: rgba(255, 255, 255, 0.8);
      }
    }

    .type-section {
      margin-bottom: 16rpx;

      &:last-child {
        margin-bottom: 0;
      }

      .type-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12rpx 20rpx;

        &.type-club {
          background: #d1fae5;

          .type-title {
            color: #059669;
            font-size: 26rpx;
            font-weight: 600;
          }

          .type-count {
            color: #047857;
            font-size: 22rpx;
          }
        }

        &.type-regular {
          background: #dbeafe;

          .type-title {
            color: #1e40af;
            font-size: 26rpx;
            font-weight: 600;
          }

          .type-count {
            color: #1e3a8a;
            font-size: 22rpx;
          }
        }
      }

      .slots-list {
        background: #fff;
      }
    }

    .slots-list {
      background: #fff;
      border-radius: 0 0 12rpx 12rpx;
      overflow: hidden;

      .slot-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20rpx;
        border-bottom: 1rpx solid #f3f4f6;

        &:last-child {
          border-bottom: none;
        }

        .slot-header {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8rpx;

          .time-info {
            display: flex;
            align-items: center;
            gap: 8rpx;

            .time-text {
              font-size: 32rpx;
              font-weight: bold;
              color: #333;
            }

            .badges {
              display: flex;
              gap: 8rpx;

              .badge {
                padding: 4rpx 12rpx;
                font-size: 22rpx;
                border-radius: 6rpx;

                &.badge-club {
                  background: #d1fae5;
                  color: #059669;
                }

                &.badge-inactive {
                  background: #fee2e2;
                  color: #dc2626;
                }
              }
            }
          }

          .slot-details {
            display: flex;
            flex-wrap: wrap;
            gap: 16rpx;

            .detail-text {
              font-size: 24rpx;
              color: #6b7280;
            }
          }
        }

        .slot-actions {
          display: flex;
          gap: 12rpx;

          .btn-mini {
            padding: 12rpx 24rpx;
            font-size: 24rpx;
            border-radius: 8rpx;
            border: none;

            &.btn-edit {
              background: #dbeafe;
              color: #2563eb;
            }

            &.btn-delete {
              background: #fee2e2;
              color: #dc2626;
            }
          }
        }
      }
    }
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 998;

  .modal-content {
    width: 640rpx;
    max-height: 80vh;
    background: #fff;
    border-radius: 24rpx;
    overflow: hidden;
    position: relative;
    z-index: 1000;

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 32rpx;
      border-bottom: 2rpx solid #f3f4f6;

      .modal-title {
        font-size: 32rpx;
        font-weight: bold;
        color: #333;
      }

      .modal-close {
        font-size: 56rpx;
        color: #9ca3af;
        line-height: 1;
      }
    }

    .modal-body {
      padding: 32rpx;
      max-height: 50vh;
      overflow-y: auto;

      .form-item {
        margin-bottom: 24rpx;

        &.half {
          width: calc(50% - 12rpx);
          display: inline-block;
        }

        &:last-child {
          margin-bottom: 0;
        }

        .label {
          display: block;
          font-size: 28rpx;
          color: #333;
          margin-bottom: 12rpx;
        }

        .picker {
          height: 80rpx;
          line-height: 80rpx;
          padding: 0 24rpx;
          border: 2rpx solid #e5e7eb;
          border-radius: 12rpx;
          font-size: 28rpx;
          background: #f9fafb;
          color: #333;
        }

        .input {
          width: 100%;
          height: 80rpx;
          padding: 0 24rpx;
          border: 2rpx solid #e5e7eb;
          border-radius: 12rpx;
          font-size: 28rpx;
          background: #f9fafb;
        }

        .radio-group {
          display: flex;
          gap: 32rpx;

          .radio-item {
            display: flex;
            align-items: center;
            gap: 8rpx;
            font-size: 28rpx;
            color: #333;
          }
        }

        .switch-container {
          display: flex;
          align-items: center;
            gap: 16rpx;

          .switch-label {
            font-size: 28rpx;
            color: #333;
          }
        }

        .days-selector {
          display: flex;
          flex-wrap: wrap;
          gap: 12rpx;

          .day-checkbox {
            display: flex;
            align-items: center;
            gap: 6rpx;
            padding: 12rpx 16rpx;
            border: 2rpx solid #e5e7eb;
            border-radius: 8rpx;
            font-size: 24rpx;
            color: #6b7280;

            &.checked {
              background: #ede9fe;
              color: #667eea;
              border-color: #667eea;
            }
          }
        }
      }

      .form-row {
        display: flex;
        gap: 12rpx;
      }

      .info-text {
        padding: 16rpx;
        background: #f0f9ff;
        border-radius: 12rpx;
        font-size: 26rpx;
        color: #0369a1;
        line-height: 1.5;
      }
    }

    .modal-footer {
      display: flex;
      gap: 16rpx;
      padding: 32rpx;
      border-top: 2rpx solid #f3f4f6;

      .btn {
        flex: 1;
        height: 80rpx;
        line-height: 80rpx;
        text-align: center;
        font-size: 28rpx;
        border-radius: 12rpx;
        border: none;

        &.btn-outline {
          background: #f3f4f6;
          color: #6b7280;
        }

        &.btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #fff;
        }
      }
    }
  }
}
</style>
