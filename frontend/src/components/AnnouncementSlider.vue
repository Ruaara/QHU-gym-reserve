<template>
  <view class="announcement-slider" v-if="announcements.length > 0">
    <view class="swiper-wrapper">
      <swiper
        :current="currentIndex"
        :indicator-dots="true"
        :autoplay="true"
        :interval="3000"
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
              :src="item.imageUrl"
              class="announcement-image"
              mode="aspectFill"
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
import { ref, onMounted } from 'vue';
import { getAnnouncements } from '@/api';

interface Announcement {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
  linkUrl: string;
}

const announcements = ref<Announcement[]>([]);
const currentIndex = ref(0);

// 加载公告列表
const loadAnnouncements = async () => {
  try {
    const res = await getAnnouncements();
    announcements.value = res.announcements;
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

// 上一张
const prevSlide = () => {
  const length = announcements.value.length;
  if (length > 0) {
    currentIndex.value = currentIndex.value === 0 ? length - 1 : currentIndex.value - 1;
  }
};

// 下一张
const nextSlide = () => {
  const length = announcements.value.length;
  if (length > 0) {
    currentIndex.value = currentIndex.value === length - 1 ? 0 : currentIndex.value + 1;
  }
};

onMounted(() => {
  loadAnnouncements();
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
