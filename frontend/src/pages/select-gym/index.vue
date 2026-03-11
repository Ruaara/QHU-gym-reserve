<template>
  <view class="select-gym-container">
    <view class="page-title">选择健身房</view>

    <view v-if="loading" class="loading">
      <text>加载中...</text>
    </view>

    <view v-else class="gyms-list">
      <view
        v-for="(gym, index) in gyms"
        :key="gym.id"
        class="gym-card"
        @click="handleCardClick(gym, index)"
      >
        <image
          :src="gym.imageUrl || defaultImage"
          class="gym-image"
          mode="aspectFill"
          @error.stop="handleImageError(index)"
        />
        <text class="gym-name-overlay" :class="{ 'name-hidden': gymStates[gym.id]?.showDetail }">{{ gym.name }}</text>
        <view
          class="gym-overlay"
          :class="{ 'overlay-active': gymStates[gym.id]?.showDetail }"
          @click.stop="toggleDetail(gym.id)"
        >
          <view v-if="gymStates[gym.id]?.showDetail" class="gym-detail">
            <text class="detail-title">{{ gym.name }}</text>
            <text class="detail-desc">{{ gym.description || '暂无描述' }}</text>
          </view>
        </view>
        <view class="detail-btn" @click.stop="toggleDetail(gym.id)">
          <text class="detail-text">{{ gymStates[gym.id]?.showDetail ? '< 返回' : '了解详情' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { getGyms } from '@/api';

interface Gym {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
}

interface GymState {
  showDetail: boolean;
}

const gyms = ref<Gym[]>([]);
const gymStates = reactive<Record<number, GymState>>({});
const loading = ref(true);
const defaultImage = 'https://picsum.photos/seed/gym/400/400.jpg';
const useFreeReserve = ref(false); // 是否使用免预约

// 加载健身房列表
const loadGyms = async () => {
  try {
    const res = await getGyms();
    gyms.value = res.gyms;
    // 初始化每个健身房的状态
    res.gyms.forEach((gym: Gym) => {
      if (!gymStates[gym.id]) {
        gymStates[gym.id] = { showDetail: false };
      }
    });
  } catch (error) {
    console.error('加载健身房列表失败:', error);
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

// 切换详情显示
const toggleDetail = (gymId: number) => {
  if (!gymStates[gymId]) {
    gymStates[gymId] = { showDetail: false };
  }
  gymStates[gymId].showDetail = !gymStates[gymId].showDetail;
};

// 图片加载失败处理
const handleImageError = (index: number) => {
  console.log('图片加载失败，使用占位图');
};

// 点击卡片跳转
const handleCardClick = (gym: Gym, index: number) => {
  if (gymStates[gym.id]?.showDetail) return; // 如果显示详情，不跳转
  const url = `/pages/select-time/index?gymId=${gym.id}&gymName=${encodeURIComponent(gym.name)}` +
    (useFreeReserve.value ? '&useFreeReserve=true' : '');
  uni.navigateTo({ url });
};

onMounted(() => {
  // 获取URL参数
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1] as any;
  const options = currentPage.options || {};
  useFreeReserve.value = options.useFreeReserve === 'true';

  loadGyms();
});
</script>

<style lang="scss" scoped>
.select-gym-container {
  min-height: 100vh;
  padding: 20rpx;
  background: #f5f5f5;
}

.page-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
  text-align: center;
  margin-bottom: 30rpx;
  padding-top: 20rpx;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 50vh;
  font-size: 28rpx;
  color: #9ca3af;
}

.gyms-list {
  display: flex;
  flex-direction: column;
  gap: 30rpx;
}

.gym-card {
  position: relative;
  width: 100%;
  height: 500rpx;
  border-radius: 24rpx;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}

.gym-image {
  width: 100%;
  height: 100%;
  display: block;
}

.gym-name-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 63rpx;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.5);
  z-index: 5;
  white-space: nowrap;
  opacity: 0.8;
  transition: opacity 0.3s ease;

  &.name-hidden {
    opacity: 0;
  }
}

.gym-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
  opacity: 0;
  pointer-events: none;
  transition: all 0.3s ease;
  background: transparent;

  &.overlay-active {
    opacity: 1;
    pointer-events: auto;
    background: rgba(0, 0, 0, 0.7);
  }
}

.gym-detail {
  text-align: center;

  .detail-title {
    display: block;
    font-size: 40rpx;
    font-weight: bold;
    color: #fff;
    margin-bottom: 20rpx;
  }

  .detail-desc {
    display: block;
    font-size: 30rpx;
    color: #fff;
    line-height: 1.6;
  }
}

.detail-btn {
  position: absolute;
  bottom: 20rpx;
  left: 20rpx;
  padding: 16rpx 32rpx;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 40rpx;
  backdrop-filter: blur(10rpx);
  z-index: 10;

  .detail-text {
    font-size: 28rpx;
    color: #fff;
    font-weight: 500;
  }
}
</style>
