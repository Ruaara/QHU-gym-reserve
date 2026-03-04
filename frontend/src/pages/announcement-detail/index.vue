<template>
  <view class="announcement-detail-container">
    <view class="page-header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">‹</text>
        <text class="back-text">返回</text>
      </view>
    </view>

    <view v-if="loading" class="loading">
      <text>加载中...</text>
    </view>

    <view v-else-if="announcement" class="detail-content">
      <!-- 图片 -->
      <view class="image-wrapper">
        <image
          :src="announcement.imageUrl"
          class="announcement-image"
          mode="aspectFill"
          @error="handleImageError"
        />
        <!-- 生成随机占位图 -->
        <image
          v-if="imageError"
          :src="placeholderUrl"
          class="announcement-image"
          mode="aspectFill"
        />
      </view>

      <!-- 标题 -->
      <view class="title-section">
        <text class="title">{{ announcement.title }}</text>
        <text class="date">{{ formatDate(announcement.createdAt) }}</text>
      </view>

      <!-- 正文内容 -->
      <view class="content-section">
        <text class="content-label">正文内容</text>
        <text class="content-text">{{ announcement.content || announcement.description || '暂无详细内容' }}</text>
      </view>

      <!-- 跳转按钮（如果有链接） -->
      <view v-if="announcement.linkUrl" class="action-section">
        <button class="action-btn" @click="handleLinkClick">
          <text>查看详情 ›</text>
        </button>
      </view>
    </view>

    <view v-else class="error-state">
      <text class="error-text">公告不存在</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { getAnnouncements } from '@/api';

const announcement = ref<any>(null);
const loading = ref(true);
const imageError = ref(false);

// 生成随机占位图URL
const placeholderUrl = computed(() => {
  if (!announcement.value) return '';
  const seed = announcement.value.id || 'default';
  return `https://picsum.photos/seed/${seed}/750/400.jpg`;
});

// 格式化日期
const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 加载公告详情
const loadAnnouncement = async () => {
  try {
    loading.value = true;
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const options = currentPage.options as any;

    const res = await getAnnouncements();
    const found = res.announcements.find((a: any) => a.id === parseInt(options.id));

    if (found) {
      announcement.value = found;
    }
  } catch (error) {
    console.error('加载公告失败:', error);
  } finally {
    loading.value = false;
  }
};

// 图片加载错误处理
const handleImageError = () => {
  imageError.value = true;
};

// 返回
const goBack = () => {
  uni.navigateBack();
};

// 处理链接点击
const handleLinkClick = () => {
  if (!announcement.value?.linkUrl) return;

  if (announcement.value.linkUrl.startsWith('http://') || announcement.value.linkUrl.startsWith('https://')) {
    // 外部链接
    window.open(announcement.value.linkUrl, '_blank');
  } else {
    // 内部页面
    uni.navigateTo({
      url: announcement.value.linkUrl
    });
  }
};

onMounted(() => {
  loadAnnouncement();
});
</script>

<style lang="scss" scoped>
.announcement-detail-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.page-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20rpx;
  padding-top: calc(20rpx + env(safe-area-inset-top));

  .back-btn {
    display: flex;
    align-items: center;
    gap: 8rpx;
    color: #fff;

    .back-icon {
      font-size: 48rpx;
      line-height: 1;
    }

    .back-text {
      font-size: 28rpx;
    }
  }
}

.loading,
.error-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 50vh;
  font-size: 28rpx;
  color: #9ca3af;
}

.detail-content {
  .image-wrapper {
    position: relative;
    width: 100%;
    height: 400rpx;
    background: #f3f4f6;
    overflow: hidden;

    .announcement-image {
      width: 100%;
      height: 100%;
    }
  }

  .title-section {
    background: #fff;
    padding: 32rpx;
    margin-bottom: 20rpx;

    .title {
      display: block;
      font-size: 40rpx;
      font-weight: bold;
      color: #333;
      line-height: 1.4;
      margin-bottom: 16rpx;
    }

    .date {
      display: block;
      font-size: 24rpx;
      color: #9ca3af;
    }
  }

  .content-section {
    background: #fff;
    padding: 32rpx;
    margin-bottom: 20rpx;

    .content-label {
      display: block;
      font-size: 28rpx;
      font-weight: bold;
      color: #333;
      margin-bottom: 20rpx;
      padding-bottom: 16rpx;
      border-bottom: 2rpx solid #f3f4f6;
    }

    .content-text {
      display: block;
      font-size: 30rpx;
      color: #555;
      line-height: 1.8;
    }
  }

  .action-section {
    padding: 0 20rpx;
    margin-bottom: 40rpx;

    .action-btn {
      width: 100%;
      height: 88rpx;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      font-size: 32rpx;
      border-radius: 16rpx;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
}
</style>
