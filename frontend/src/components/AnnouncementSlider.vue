<template>
  <view class="announcement-slider" v-if="announcements.length > 0">
    <view class="swiper-wrapper">
      <swiper
        :current="currentIndex"
        :indicator-dots="true"
        :autoplay="false"
        :circular="true"
        indicator-color="rgba(255, 255, 255, 0.5)"
        indicator-active-color="#ffffff"
        class="swiper-container"
        @change="handleSwiperChange"
      >
        <swiper-item
          v-for="item in announcements"
          :key="item.id"
          class="swiper-item"
          @click="handleClick(item)"
        >
          <view class="announcement-card">
            <image
              :src="item.imageUrl || defaultImage"
              class="announcement-image"
              mode="aspectFill"
              @error="handleImageError(item)"
            />
            <view class="announcement-info">
              <text class="announcement-title">{{ item.title }}</text>
              <text v-if="item.description" class="announcement-desc">{{ item.description }}</text>
            </view>
          </view>
        </swiper-item>
      </swiper>

      <!-- 左箭头按钮 -->
      <view class="arrow-btn arrow-left" @click.stop="prevSlide">
        <text class="arrow-icon">‹</text>
      </view>

      <!-- 右箭头按钮 -->
      <view class="arrow-btn arrow-right" @click.stop="nextSlide">
        <text class="arrow-icon">›</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { getAnnouncements } from '@/api';

interface Announcement {
  id: number;
  title: string;
  description: string;
  imageUrl?: string;
  linkUrl?: string;
}

const announcements = ref<Announcement[]>([]);
const currentIndex = ref(0);
let autoPlayTimer: number | null = null;

// 默认公告图片
const defaultImage = 'https://picsum.photos/seed/announcement/800/400.jpg';

// 处理图片加载失败
const handleImageError = (item: Announcement) => {
  console.log('公告图片加载失败，使用默认图片:', item.title);
  item.imageUrl = defaultImage;
};

// 加载公告列表
const loadAnnouncements = async () => {
  try {
    const res = await getAnnouncements();
    // 为没有图片的公告设置默认图片
    announcements.value = res.announcements.map((item: Announcement) => ({
      ...item,
      imageUrl: item.imageUrl || defaultImage
    }));
  } catch (error) {
    console.error('加载公告失败:', error);
  }
};

// 处理点击事件 - 跳转到详情页
const handleClick = (item: Announcement) => {
  uni.navigateTo({
    url: `/pages/announcement-detail/index?id=${item.id}`
  });
};

// 处理 swiper 变化
const handleSwiperChange = (e: any) => {
  currentIndex.value = e.detail.current;
};

// 启动自动播放
const startAutoPlay = () => {
  stopAutoPlay(); // 先清除已有的定时器
  autoPlayTimer = setInterval(() => {
    const length = announcements.value.length;
    if (length > 0) {
      currentIndex.value = currentIndex.value === length - 1 ? 0 : currentIndex.value + 1;
    }
  }, 3000) as unknown as number;
};

// 停止自动播放
const stopAutoPlay = () => {
  if (autoPlayTimer !== null) {
    clearInterval(autoPlayTimer);
    autoPlayTimer = null;
  }
};

// 重置自动播放（用户手动切换时调用）
const resetAutoPlay = () => {
  startAutoPlay();
};

// 上一张
const prevSlide = () => {
  const length = announcements.value.length;
  if (length > 0) {
    currentIndex.value = currentIndex.value === 0 ? length - 1 : currentIndex.value - 1;
    resetAutoPlay(); // 重置自动播放计时器
  }
};

// 下一张
const nextSlide = () => {
  const length = announcements.value.length;
  if (length > 0) {
    currentIndex.value = currentIndex.value === length - 1 ? 0 : currentIndex.value + 1;
    resetAutoPlay(); // 重置自动播放计时器
  }
};

onMounted(async () => {
  await loadAnnouncements();
  startAutoPlay(); // 启动自动播放
});

onUnmounted(() => {
  stopAutoPlay(); // 组件卸载时清除定时器
});
</script>

<style lang="scss" scoped>
.announcement-slider {
  margin-bottom: 20rpx;

  .swiper-wrapper {
    position: relative;
  }

  .swiper-container {
    height: 400rpx;
    border-radius: 16rpx;
    overflow: hidden;
  }

  .swiper-item {
    height: 100%;

    .announcement-card {
      position: relative;
      height: 100%;

      .announcement-image {
        width: 100%;
        height: 100%;
      }

      .announcement-info {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 40rpx 30rpx 30rpx;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 100%);

        .announcement-title {
          display: block;
          font-size: 32rpx;
          font-weight: bold;
          color: #fff;
          margin-bottom: 8rpx;
          text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.3);
        }

        .announcement-desc {
          display: block;
          font-size: 24rpx;
          color: rgba(255, 255, 255, 0.9);
          text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.3);
          line-height: 1.4;
        }
      }
    }
  }

  .arrow-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 70rpx;
    height: 70rpx;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    z-index: 10;

    &:active {
      background: rgba(0, 0, 0, 0.5);
      transform: translateY(-50%) scale(0.95);
    }

    &.arrow-left {
      left: 20rpx;
    }

    &.arrow-right {
      right: 20rpx;
    }

    .arrow-icon {
      font-size: 64rpx;
      color: rgba(255, 255, 255, 0.8);
      font-weight: 300;
      line-height: 1;
    }
  }
}
</style>
