<template>
  <view class="profile-container">
    <!-- 管理员摄像头扫码按钮 -->
    <view v-if="userStore.isAdmin" class="admin-camera-btn" @click="openCameraScanModal">
      <text class="scan-icon">📷</text>
    </view>

    <!-- 用户信息卡片 -->
    <view class="user-info-card">
      <view class="user-avatar">
        <text class="avatar-icon">👤</text>
      </view>
      <view class="user-details">
        <text class="user-name">{{ userStore.user?.name }}</text>
        <text class="user-account">学号：{{ userStore.user?.account }}</text>
      </view>
      <view class="user-role-badge" :class="roleClass">
        <text class="role-text">{{ roleText }}</text>
      </view>
    </view>

    <!-- 预约状态 -->
    <view class="status-card">
      <view class="status-title">预约状态</view>
      <view class="status-item">
        <text class="status-label">今日预约</text>
        <text class="status-value" :class="{ 'reserved': todayReserved }">
          {{ todayReserved ? '已预约' : '未预约' }}
        </text>
      </view>
      <view class="status-item">
        <text class="status-label">今日更改机会</text>
        <text class="status-value">{{ todayChange }} 次</text>
      </view>
      <view class="status-item">
        <text class="status-label">免预约次数</text>
        <text class="status-value" :class="{ 'has-free': freeReserveCount > 0 }">
          {{ freeReserveCount }} 次
        </text>
      </view>
      <!-- 我的二维码按钮 -->
      <view v-if="todayReserved" class="status-actions">
        <button class="btn-qrcode" @click="openQrCodeModal">
          <text class="btn-qrcode-icon">📱</text>
          <text class="btn-qrcode-text">我的二维码</text>
        </button>
      </view>
    </view>

    <!-- 我的预约 -->
    <view class="section">
      <view class="section-title">我的预约</view>
      <view v-if="loadingReservations" class="loading-state">
        <text>加载中...</text>
      </view>
      <view v-else-if="reservations.length === 0" class="empty-state">
        <text class="empty-text">暂无预约记录</text>
      </view>
      <view v-else class="reservation-list">
        <view
          v-for="reservation in reservations"
          :key="reservation.id"
          class="reservation-item"
          :class="{ 'reservation-used': reservation.isUsed }"
        >
          <view class="reservation-info">
            <view class="reservation-date">
              <text class="date-label">日期</text>
              <text class="date-value">{{ reservation.reservationDate }}</text>
            </view>
            <view class="reservation-time">
              <text class="time-label">时间</text>
              <text class="time-value">{{ reservation.startTime }} - {{ reservation.endTime }}</text>
            </view>
            <view class="reservation-gym">
              <text class="gym-label">健身房</text>
              <text class="gym-value">{{ reservation.gymName }}</text>
            </view>
          </view>
          <view class="reservation-actions">
            <view v-if="reservation.isUsed" class="reservation-used-badge">
              <text class="used-badge-text">✓ 已经核销</text>
            </view>
            <button v-else class="btn-cancel-reservation" @click="handleCancelReservation(reservation.id)">
              取消预约
            </button>
          </view>
        </view>
      </view>
    </view>

    <!-- 功能列表 -->
    <view class="action-list">
      <view class="action-item" @click="openPasswordModal">
        <text class="action-icon">🔒</text>
        <text class="action-text">修改密码</text>
        <text class="action-arrow">›</text>
      </view>
      <view class="action-item" @click="handleLogout">
        <text class="action-icon">🚪</text>
        <text class="action-text">退出登录</text>
        <text class="action-arrow">›</text>
      </view>
    </view>

    <!-- 修改密码弹窗 -->
    <view v-if="showPasswordModal" class="modal-mask" @click="hidePasswordModal">
      <view class="modal-content" @click.stop>
        <view class="modal-title">修改密码</view>
        <view class="modal-form">
          <view class="form-item">
            <text class="form-label">原密码</text>
            <input
              v-model="passwordForm.oldPassword"
              class="form-input"
              type="password"
              placeholder="请输入原密码"
            />
          </view>
          <view class="form-item">
            <text class="form-label">新密码</text>
            <input
              v-model="passwordForm.newPassword"
              class="form-input"
              type="password"
              placeholder="请输入新密码（6-20位）"
            />
          </view>
          <view class="form-item">
            <text class="form-label">确认密码</text>
            <input
              v-model="passwordForm.confirmPassword"
              class="form-input"
              type="password"
              placeholder="请再次输入新密码"
            />
          </view>
        </view>
        <view class="modal-buttons">
          <button class="modal-btn btn-cancel" @click="hidePasswordModal">取消</button>
          <button class="modal-btn btn-confirm" @click="changePassword">确定</button>
        </view>
      </view>
    </view>

    <!-- 二维码弹窗 -->
    <view v-if="showQrCodeModal" class="modal-mask" @click="hideQrCodeModal">
      <view class="modal-content qr-modal-content" @click.stop>
        <view class="modal-title">我的预约二维码</view>
        <view v-if="loadingQrCode" class="qr-loading">
          <text>加载中...</text>
        </view>
        <view v-else class="qr-display">
          <view v-if="qrCodeData" class="qr-info">
            <view class="qr-info-item">
              <text class="qr-info-label">健身房：</text>
              <text class="qr-info-value">{{ qrCodeData.reservation?.gymName }}</text>
            </view>
            <view class="qr-info-item">
              <text class="qr-info-label">日期：</text>
              <text class="qr-info-value">{{ qrCodeData.reservation?.date }}</text>
            </view>
            <view class="qr-info-item">
              <text class="qr-info-label">时间：</text>
              <text class="qr-info-value">{{ qrCodeData.reservation?.startTime }} - {{ qrCodeData.reservation?.endTime }}</text>
            </view>
            <view v-if="qrCodeData.isUsed" class="qr-status qr-used">
              <text class="status-icon">✓</text>
              <text class="status-text">已核销</text>
            </view>
            <view v-else class="qr-status qr-pending">
              <text class="status-icon">⏱</text>
              <text class="status-text">待核销</text>
            </view>
          </view>
          <view class="qr-image-container">
            <image
              v-if="qrCodeData?.qrCodeImage"
              :src="qrCodeData.qrCodeImage"
              class="qr-image"
              mode="widthFix"
            />
          </view>
          <view class="qr-tip">
            <text class="tip-text">请向核销人员出示此二维码</text>
          </view>
        </view>
        <view class="modal-buttons">
          <button class="modal-btn btn-close" @click="hideQrCodeModal">关闭</button>
        </view>
      </view>
    </view>

    <!-- 管理员扫码弹窗 -->
    <view v-if="showAdminScanModal" class="modal-mask" @click="hideScanModal">
      <view class="modal-content scan-modal-content" @click.stop>
        <view class="modal-title">扫码核销</view>
        <view class="scan-description">
          <text class="desc-text">请上传包含二维码的图片进行核销</text>
        </view>
        <view class="scan-upload-area" @click="chooseImage">
          <view v-if="!scannedImage" class="upload-placeholder">
            <text class="upload-icon">📷</text>
            <text class="upload-text">点击上传二维码图片</text>
          </view>
          <view v-else class="uploaded-image-container">
            <image :src="scannedImage" class="uploaded-image" mode="aspectFit" />
            <view class="image-remove" @click.stop="removeImage">
              <text class="remove-icon">×</text>
            </view>
          </view>
        </view>
        <view class="scan-status" v-if="scanResult">
          <view v-if="scanResult.success" class="status-success">
            <text class="status-icon">✓</text>
            <text class="status-message">{{ scanResult.message }}</text>
          </view>
          <view v-else class="status-error">
            <text class="status-icon">✕</text>
            <text class="status-message">{{ scanResult.message }}</text>
          </view>
        </view>
        <view class="modal-buttons">
          <button class="modal-btn btn-cancel" @click="hideScanModal">取消</button>
          <button
            class="modal-btn btn-confirm"
            :class="{ 'btn-disabled': !scannedImage || scanning }"
            :disabled="!scannedImage || scanning"
            @click="verifyQrCode"
          >
            {{ scanning ? '识别中...' : '确认核销' }}
          </button>
        </view>
      </view>
    </view>

    <!-- 摄像头扫码弹窗 -->
    <view v-if="showCameraScanModal" class="modal-mask" @click="hideCameraScanModal">
      <view class="modal-content camera-scan-modal-content" @click.stop>
        <view class="modal-title">摄像头扫码核销</view>
        <view class="scan-description">
          <text class="desc-text">点击下方按钮，将调起扫码界面扫描二维码</text>
        </view>
        <view class="camera-scan-area">
          <view class="camera-placeholder">
            <text class="placeholder-icon">📷</text>
            <text class="placeholder-text">点击下方按钮启动扫码</text>
          </view>
        </view>
        <view class="scan-status" v-if="cameraScanResult">
          <view v-if="cameraScanResult.success" class="status-success">
            <text class="status-icon">✓</text>
            <text class="status-message">{{ cameraScanResult.message }}</text>
          </view>
          <view v-else class="status-error">
            <text class="status-icon">✕</text>
            <text class="status-message">{{ cameraScanResult.message }}</text>
          </view>
        </view>
        <view class="modal-buttons">
          <button class="modal-btn btn-cancel" @click="hideCameraScanModal">取消</button>
          <button class="modal-btn btn-confirm" @click="startCameraScan">
            启动扫码
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/user';
import { changePasswordApi, getReservationLimitStatus, getMyReservations, cancelReservation, getMyQrCode, verifyQrCode as verifyQrCodeApi, getCurrentUser } from '@/api';
import jsQR from 'jsqr';

const userStore = useUserStore();

const showPasswordModal = ref(false);
const showQrCodeModal = ref(false);
const showAdminScanModal = ref(false);
const showCameraScanModal = ref(false);
const todayReserved = ref(false);
const todayChange = ref(1);
const freeReserveCount = ref(0);
const reservations = ref<any[]>([]);
const loadingReservations = ref(false);
const loadingQrCode = ref(false);
const qrCodeData = ref<any>(null);
const scannedImage = ref<string>('');
const scanning = ref(false);
const scanResult = ref<{ success: boolean; message: string } | null>(null);

// 摄像头扫码相关
const cameraStarted = ref(false);
const cameraScanning = ref(false);
const cameraScanResult = ref<{ success: boolean; message: string } | null>(null);
let videoStream: MediaStream | null = null;
let scanInterval: number | null = null;

const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
});

// 身份文本
const roleText = computed(() => {
  const user = userStore.user;
  if (!user) return '';

  if (user.role === 'main_admin') return '超级管理员';
  if (user.role === 'admin') return '管理员';
  if (user.isClub) return '社团学生';
  return '学生';
});

// 身份样式类
const roleClass = computed(() => {
  const user = userStore.user;
  if (!user) return '';

  if (user.role === 'main_admin') return 'role-main-admin';
  if (user.role === 'admin') return 'role-admin';
  if (user.isClub) return 'role-club';
  return 'role-student';
});

// 加载用户状态
const loadUserStatus = async () => {
  try {
    // 获取预约限制状态
    const res = await getReservationLimitStatus();
    todayReserved.value = res.today_reserved;
    todayChange.value = res.today_change;

    // 获取用户信息（包括免预约次数）
    const user = await getCurrentUser();
    freeReserveCount.value = user.freeReserveCount || 0;
  } catch (error) {
    console.error('加载用户状态失败', error);
  }
};

// 显示修改密码弹窗
const openPasswordModal = () => {
  passwordForm.value = {
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
  showPasswordModal.value = true;
};

// 隐藏修改密码弹窗
const hidePasswordModal = () => {
  showPasswordModal.value = false;
};

// 修改密码
const changePassword = async () => {
  const { oldPassword, newPassword, confirmPassword } = passwordForm.value;

  if (!oldPassword) {
    uni.showToast({ title: '请输入原密码', icon: 'none' });
    return;
  }

  if (!newPassword) {
    uni.showToast({ title: '请输入新密码', icon: 'none' });
    return;
  }

  if (newPassword.length < 6 || newPassword.length > 20) {
    uni.showToast({ title: '新密码长度应为6-20位', icon: 'none' });
    return;
  }

  if (newPassword !== confirmPassword) {
    uni.showToast({ title: '两次输入的密码不一致', icon: 'none' });
    return;
  }

  if (oldPassword === newPassword) {
    uni.showToast({ title: '新密码不能与原密码相同', icon: 'none' });
    return;
  }

  try {
    uni.showLoading({ title: '修改中...' });

    await changePasswordApi({
      oldPassword,
      newPassword
    });

    uni.hideLoading();
    uni.showToast({ title: '密码修改成功', icon: 'success' });

    setTimeout(() => {
      hidePasswordModal();
    }, 1500);
  } catch (error: any) {
    uni.hideLoading();
    uni.showToast({ title: error.error || '修改密码失败', icon: 'none' });
  }
};

// 显示二维码弹窗
const openQrCodeModal = async () => {
  showQrCodeModal.value = true;
  await loadQrCode();
};

// 隐藏二维码弹窗
const hideQrCodeModal = () => {
  showQrCodeModal.value = false;
};

// 加载二维码
const loadQrCode = async () => {
  try {
    loadingQrCode.value = true;
    const res = await getMyQrCode();
    qrCodeData.value = res;
  } catch (error: any) {
    console.error('加载二维码失败', error);
    uni.showToast({ title: error.error || '加载二维码失败', icon: 'none' });
  } finally {
    loadingQrCode.value = false;
  }
};

// 显示管理员扫码弹窗
const showScanModal = () => {
  showAdminScanModal.value = true;
  scannedImage.value = '';
  scanResult.value = null;
};

// 隐藏管理员扫码弹窗
const hideScanModal = () => {
  showAdminScanModal.value = false;
  scannedImage.value = '';
  scanResult.value = null;
};

// 显示摄像头扫码弹窗（直接启动扫码）
const openCameraScanModal = () => {
  startCameraScan();
};

// 隐藏摄像头扫码弹窗
const hideCameraScanModal = () => {
  showCameraScanModal.value = false;
  cameraScanResult.value = null;
  stopCamera();
};

// 启动摄像头扫码
const startCameraScan = () => {
  try {
    cameraScanResult.value = null;

    // 使用UniApp的扫码API（H5和小程序通用）
    uni.scanCode({
      success: (res: any) => {
        console.log('扫码成功:', res);
        // 验证二维码数据
        if (res.result) {
          verifyCameraQrCode(res.result);
        } else {
          cameraScanResult.value = {
            success: false,
            message: '扫码失败，未获取到二维码数据'
          };
        }
      },
      fail: (err: any) => {
        console.error('扫码失败:', err);
        // 用户取消扫码，不显示错误
        if (err.errMsg && err.errMsg.includes('cancel')) {
          cameraScanResult.value = null;
          setTimeout(() => {
            hideCameraScanModal();
          }, 500);
          return;
        }
        cameraScanResult.value = {
          success: false,
          message: err.errMsg || '扫码失败'
        };
      },
      complete: () => {
        // 扫码完成后关闭弹窗（成功的话在verifyCameraQrCode中延迟关闭）
        if (!cameraScanResult.value || !cameraScanResult.value.success) {
          setTimeout(() => {
            hideCameraScanModal();
          }, 2000);
        }
      }
    });
  } catch (error: any) {
    console.error('启动扫码失败:', error);
    cameraScanResult.value = {
      success: false,
      message: error.message || '扫码功能不可用'
    };
  }
};

// 停止摄像头（UniApp扫码API会自动关闭）
const stopCamera = () => {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  cameraStarted.value = false;
  cameraScanning.value = false;
};

// 验证摄像头扫描的二维码
const verifyCameraQrCode = async (qrCodeData: string) => {
  try {
    cameraScanResult.value = null;

    // 验证二维码
    const result = await verifyQrCodeApi(qrCodeData);

    cameraScanResult.value = {
      success: true,
      message: result.message || '核销成功'
    };

    uni.showToast({ title: '核销成功', icon: 'success' });

    setTimeout(() => {
      hideCameraScanModal();
    }, 2000);
  } catch (error: any) {
    cameraScanResult.value = {
      success: false,
      message: error.error || '核销失败'
    };

    // 不自动重新启动，让用户手动点击
  }
};

// 选择图片
const chooseImage = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      scannedImage.value = res.tempFilePaths[0];
      scanResult.value = null;
    }
  });
};

// 移除图片
const removeImage = () => {
  scannedImage.value = '';
  scanResult.value = null;
};

// 验证二维码
const verifyQrCode = async () => {
  if (!scannedImage.value) {
    uni.showToast({ title: '请先上传二维码图片', icon: 'none' });
    return;
  }

  try {
    scanning.value = true;
    scanResult.value = null;

    // 使用 jsQR 读取二维码
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = async () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);

      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);

      if (!imageData) {
        scanResult.value = {
          success: false,
          message: '无法读取图片数据'
        };
        scanning.value = false;
        return;
      }

      // 使用 jsQR 读取二维码
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (!code || !code.data) {
        scanResult.value = {
          success: false,
          message: '未识别到二维码，请确保图片清晰'
        };
        scanning.value = false;
        return;
      }

      // 验证二维码
      try {
        const result = await verifyQrCodeApi(code.data);
        scanResult.value = {
          success: true,
          message: result.message || '核销成功'
        };
        uni.showToast({ title: '核销成功', icon: 'success' });

        setTimeout(() => {
          hideScanModal();
        }, 2000);
      } catch (error: any) {
        scanResult.value = {
          success: false,
          message: error.error || '核销失败'
        };
      } finally {
        scanning.value = false;
      }
    };

    img.onerror = () => {
      scanResult.value = {
        success: false,
        message: '图片加载失败'
      };
      scanning.value = false;
    };

    img.src = scannedImage.value;
  } catch (error: any) {
    scanResult.value = {
      success: false,
      message: error.error || '识别失败，请重试'
    };
    scanning.value = false;
  }
};

// 加载预约记录
const loadReservations = async () => {
  try {
    loadingReservations.value = true;
    const res = await getMyReservations();
    reservations.value = res.reservations.map((r: any) => ({
      ...r,
      reservationDate: r.reservation_date,
      startTime: r.start_time,
      endTime: r.end_time
    }));
  } catch (error) {
    console.error('加载预约记录失败', error);
    uni.showToast({ title: '加载预约记录失败', icon: 'none' });
  } finally {
    loadingReservations.value = false;
  }
};

// 取消预约
const handleCancelReservation = async (reservationId: number) => {
  try {
    // 获取今日更改次数
    const limitRes = await getReservationLimitStatus();

    if (limitRes.todayChange === 0) {
      uni.showModal({
        title: '提示',
        content: '今日更改机会已用尽',
        showCancel: false,
        success: () => {}
      });
      return;
    }

    uni.showModal({
      title: '提示',
      content: '是否取消预约？',
      success: async (res) => {
        if (res.confirm) {
          try {
            uni.showLoading({ title: '取消中...' });

            await cancelReservation(reservationId);

            uni.hideLoading();
            uni.showToast({ title: '取消成功', icon: 'success' });

            // 重新加载预约记录
            await loadReservations();
            // 重新加载状态
            await loadUserStatus();
          } catch (error: any) {
            uni.hideLoading();
            uni.showToast({ title: error.error || '取消预约失败', icon: 'none' });
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
  loadUserStatus();
  loadReservations();
});
</script>

<style lang="scss" scoped>
.profile-container {
  min-height: 100vh;
  padding: 20rpx;
  background: #f5f5f5;
  position: relative;
}

// 管理员扫码按钮
.admin-scan-btn {
  position: fixed;
  top: 100rpx;
  right: 40rpx;
  width: 100rpx;
  height: 100rpx;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20rpx);
  -webkit-backdrop-filter: blur(20rpx);
  border-radius: 50%;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.12);
  z-index: 100;
  cursor: pointer;
  transition: all 0.3s;

  // 使用背景图片
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 56rpx;
    height: 56rpx;
    background-image: url('@/pics/scan-icon.jpeg');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
  }

  &:active {
    transform: scale(0.95);
  }

  .scan-icon {
    display: none; // 隐藏原来的emoji
  }
}

// 管理员摄像头扫码按钮（白色）
.admin-camera-btn {
  position: fixed;
  top: 100rpx;
  right: 40rpx;
  width: 100rpx;
  height: 100rpx;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20rpx);
  -webkit-backdrop-filter: blur(20rpx);
  border-radius: 50%;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
  z-index: 100;
  cursor: pointer;
  transition: all 0.3s;

  // 使用背景图片
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 56rpx;
    height: 56rpx;
    background-image: url('@/pics/scan-icon.jpeg');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
  }

  &:active {
    transform: scale(0.95);
  }

  .scan-icon {
    display: none; // 隐藏原来的emoji
  }
}

.user-info-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 24rpx;
  padding: 60rpx 40rpx 40rpx;
  margin-bottom: 20rpx;
}

.user-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;

  .avatar-icon {
    font-size: 60rpx;
  }
}

.user-details {
  text-align: center;
  margin-bottom: 20rpx;

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

.user-role-badge {
  padding: 12rpx 32rpx;
  border-radius: 40rpx;
  background: rgba(255, 255, 255, 0.2);

  &.role-main-admin {
    background: rgba(239, 68, 68, 0.2);
    border: 2rpx solid #ef4444;
  }

  &.role-admin {
    background: rgba(251, 146, 60, 0.2);
    border: 2rpx solid #fb923c;
  }

  &.role-club {
    background: rgba(234, 179, 8, 0.2);
    border: 2rpx solid #eab308;
  }

  &.role-student {
    background: rgba(59, 130, 246, 0.2);
    border: 2rpx solid #3b82f6;
  }

  .role-text {
    font-size: 26rpx;
    font-weight: 500;
    color: #fff;
  }
}

.status-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;

  .status-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 20rpx;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20rpx 0;
    border-bottom: 1rpx solid #f0f0f0;

    &:last-child {
      border-bottom: none;
    }

    .status-label {
      font-size: 30rpx;
      color: #666;
    }

    .status-value {
      font-size: 30rpx;
      font-weight: 500;
      color: #333;

      &.reserved {
        color: #10b981;
      }

      &.has-free {
        color: #dc2626;
      }
    }
  }

  .status-actions {
    padding-top: 20rpx;
    border-top: 1rpx solid #f0f0f0;
  }

  .btn-qrcode {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16rpx;
    padding: 24rpx;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    font-size: 30rpx;
    font-weight: 500;
    border-radius: 12rpx;
    border: none;

    &-icon {
      font-size: 36rpx;
    }

    &-text {
      font-size: 30rpx;
    }
  }
}

.action-list {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.action-item {
  display: flex;
  align-items: center;
  padding: 32rpx;
  border-bottom: 1rpx solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }

  .action-icon {
    font-size: 44rpx;
    margin-right: 20rpx;
  }

  .action-text {
    flex: 1;
    font-size: 30rpx;
    color: #333;
  }

  .action-arrow {
    font-size: 44rpx;
    color: #d1d5db;
  }
}

// 弹窗样式
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
  z-index: 9999;
  pointer-events: none;
}

.modal-content {
  width: 600rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx;
  pointer-events: auto;
}

.modal-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  text-align: center;
  margin-bottom: 40rpx;
}

.modal-form {
  .form-item {
    margin-bottom: 24rpx;

    .form-label {
      display: block;
      font-size: 28rpx;
      color: #666;
      margin-bottom: 12rpx;
    }

    .form-input {
      width: 100%;
      height: 80rpx;
      padding: 20rpx;
      font-size: 28rpx;
      border: 2rpx solid #e5e7eb;
      border-radius: 12rpx;
      background: #f9fafb;
      box-sizing: border-box;
    }
  }
}

.modal-buttons {
  display: flex;
  gap: 20rpx;
  margin-top: 40rpx;

  .modal-btn {
    flex: 1;
    padding: 24rpx;
    font-size: 30rpx;
    border-radius: 12rpx;
    border: none;

    &.btn-cancel {
      background: #f3f4f6;
      color: #666;
    }

    &.btn-confirm {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
    }

    &.btn-close {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
    }
  }
}

// 二维码弹窗样式
.qr-modal-content {
  max-width: 700rpx;
}

.qr-loading {
  text-align: center;
  padding: 60rpx 0;
  color: #999;
  font-size: 28rpx;
}

.qr-display {
  .qr-info {
    margin-bottom: 32rpx;
    padding: 24rpx;
    background: #f9fafb;
    border-radius: 16rpx;

    &-item {
      display: flex;
      margin-bottom: 12rpx;

      &:last-child {
        margin-bottom: 0;
      }

      .qr-info-label {
        font-size: 28rpx;
        color: #666;
        min-width: 140rpx;
      }

      .qr-info-value {
        font-size: 28rpx;
        color: #333;
        font-weight: 500;
      }
    }
  }

  .qr-status {
    margin-top: 20rpx;
    padding: 16rpx;
    border-radius: 12rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12rpx;

    &.qr-used {
      background: #d1fae5;

      .status-icon {
        color: #10b981;
        font-size: 32rpx;
      }

      .status-text {
        color: #10b981;
        font-size: 28rpx;
        font-weight: 500;
      }
    }

    &.qr-pending {
      background: #fef3c7;

      .status-icon {
        color: #f59e0b;
        font-size: 32rpx;
      }

      .status-text {
        color: #f59e0b;
        font-size: 28rpx;
        font-weight: 500;
      }
    }
  }

  .qr-image-container {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 32rpx;
    background: #fff;
    border-radius: 16rpx;
    margin-bottom: 24rpx;

    .qr-image {
      width: 400rpx;
      height: 400rpx;
    }
  }

  .qr-tip {
    text-align: center;
    padding: 16rpx;

    .tip-text {
      font-size: 26rpx;
      color: #999;
    }
  }
}

// 预约列表样式
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

.loading-state,
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
    flex-direction: column;
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

      .date-value,
      .time-value,
      .gym-value {
        color: #9ca3af !important;
      }
    }

    .reservation-info {
      margin-bottom: 20rpx;

      .reservation-date,
      .reservation-time,
      .reservation-gym {
        display: flex;
        justify-content: space-between;
        padding: 12rpx 0;
        border-bottom: 1rpx solid #f0f0f0;

        &:last-child {
          border-bottom: none;
        }

        .date-label,
        .time-label,
        .gym-label {
          font-size: 28rpx;
          color: #666;
        }

        .date-value,
        .time-value,
        .gym-value {
          font-size: 28rpx;
          color: #333;
          font-weight: 500;
        }
      }
    }

    .reservation-actions {
      display: flex;
      justify-content: center;
    }

    .btn-cancel-reservation {
      padding: 20rpx;
      background: #fff;
      color: #ef4444;
      font-size: 28rpx;
      border-radius: 8rpx;
      border: 1rpx solid #ef4444;
    }

    .reservation-used-badge {
      padding: 20rpx;
      text-align: center;

      .used-badge-text {
        font-size: 28rpx;
        color: #10b981;
        font-weight: 500;
      }
    }
  }
}

// 管理员扫码弹窗样式
.scan-modal-content {
  max-width: 700rpx;
}

.scan-description {
  text-align: center;
  margin-bottom: 32rpx;

  .desc-text {
    font-size: 28rpx;
    color: #666;
  }
}

.scan-upload-area {
  margin-bottom: 32rpx;

  .upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400rpx;
    border: 4rpx dashed #d1d5db;
    border-radius: 16rpx;
    background: #f9fafb;
    cursor: pointer;
    transition: all 0.3s;

    &:active {
      background: #f3f4f6;
    }

    .upload-icon {
      font-size: 100rpx;
      margin-bottom: 20rpx;
    }

    .upload-text {
      font-size: 28rpx;
      color: #9ca3af;
    }
  }

  .uploaded-image-container {
    position: relative;
    width: 100%;
    height: 400rpx;
    border-radius: 16rpx;
    overflow: hidden;
    background: #f9fafb;

    .uploaded-image {
      width: 100%;
      height: 100%;
    }

    .image-remove {
      position: absolute;
      top: 20rpx;
      right: 20rpx;
      width: 60rpx;
      height: 60rpx;
      background: rgba(0, 0, 0, 0.6);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;

      .remove-icon {
        font-size: 48rpx;
        color: #fff;
        line-height: 1;
      }
    }
  }
}

.scan-status {
  margin-bottom: 24rpx;
  padding: 20rpx;
  border-radius: 12rpx;

  &.status-success,
  &.status-error {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12rpx;
  }

  .status-success {
    background: #d1fae5;

    .status-icon {
      font-size: 36rpx;
      color: #10b981;
    }

    .status-message {
      font-size: 28rpx;
      color: #10b981;
      font-weight: 500;
    }
  }

  .status-error {
    background: #fee2e2;

    .status-icon {
      font-size: 36rpx;
      color: #ef4444;
    }

    .status-message {
      font-size: 28rpx;
      color: #ef4444;
      font-weight: 500;
    }
  }
}

.btn-disabled {
  opacity: 0.5;
  pointer-events: none;
}

// 摄像头扫码弹窗样式
.camera-scan-modal-content {
  max-width: 700rpx;
}

.camera-scan-area {
  position: relative;
  width: 100%;
  height: 400rpx;
  background: #f9fafb;
  border-radius: 16rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  .camera-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20rpx;

    .placeholder-icon {
      font-size: 120rpx;
    }

    .placeholder-text {
      font-size: 28rpx;
      color: #9ca3af;
      text-align: center;
      padding: 0 40rpx;
    }
  }
}
</style>
