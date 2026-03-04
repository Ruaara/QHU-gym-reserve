<template>
  <view class="announcements-admin-container">
    <!-- 头部 -->
    <view class="page-header">
      <text class="page-title">公告管理</text>
      <button class="btn-add" @click="openAddModal">
        <text class="add-icon">+</text>
        <text>添加公告</text>
      </button>
    </view>

    <!-- 公告列表 -->
    <view v-if="loading" class="loading">
      <text>加载中...</text>
    </view>
    <view v-else-if="announcements.length === 0" class="empty-state">
      <text class="empty-text">暂无公告</text>
    </view>
    <view v-else class="announcements-list">
      <view
        v-for="item in announcements"
        :key="item.id"
        class="announcement-card"
      >
        <view class="announcement-preview">
          <image :src="item.imageUrl" class="preview-image" mode="aspectFill" @error="handleImageError(item, $event)" />
          <image
            v-if="item.imageError"
            :src="getPlaceholderUrl(item.id)"
            class="preview-image"
            mode="aspectFill"
          />
          <view class="preview-info">
            <text class="preview-title">{{ item.title }}</text>
            <text class="preview-desc">{{ item.description || '无描述' }}</text>
          </view>
        </view>
        <view class="announcement-actions">
          <button class="btn-mini btn-edit" @click="editAnnouncement(item)">编辑</button>
          <button class="btn-mini btn-delete" @click="deleteAnnouncement(item.id)">删除</button>
        </view>
      </view>
    </view>

    <!-- 添加/编辑弹窗 -->
    <view v-if="showModal" class="modal-overlay" @click="closeModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ isEditMode ? '编辑公告' : '添加公告' }}</text>
          <text class="modal-close" @click="closeModal">×</text>
        </view>
        <view class="modal-body">
          <view class="form-item">
            <text class="label">标题 *</text>
            <input
              v-model="formData.title"
              class="input"
              placeholder="请输入公告标题"
              maxlength="100"
            />
          </view>
          <view class="form-item">
            <text class="label">简短描述</text>
            <textarea
              v-model="formData.description"
              class="textarea"
              placeholder="轮播图上显示的简短描述（可选）"
              maxlength="50"
            />
          </view>
          <view class="form-item">
            <text class="label">主内容 *</text>
            <textarea
              v-model="formData.content"
              class="textarea content-textarea"
              placeholder="公告详情页显示的主内容，支持换行"
              maxlength="500"
            />
            <text class="char-count">{{ formData.content.length }}/500</text>
          </view>
          <view class="form-item">
            <text class="label">封面图片 *</text>
            <view class="image-upload-section">
              <view v-if="formData.imageUrl" class="image-preview-wrapper">
                <image :src="formData.imageUrl" class="image-preview" mode="aspectFill" @error="handleFormImageError" />
                <image
                  v-if="formImageError"
                  :src="getPlaceholderUrl(0)"
                  class="image-preview"
                  mode="aspectFill"
                />
                <button class="btn-remove-image" @click="removeImage">删除</button>
              </view>
              <button v-else class="btn-upload" @click="chooseImage">
                <text class="upload-icon">📷</text>
                <text>选择图片</text>
              </button>
            </view>
            <text class="hint">支持 JPG、PNG、GIF、WEBP 格式，最大 5MB</text>
          </view>
          <view class="form-item">
            <text class="label">跳转链接</text>
            <input
              v-model="formData.linkUrl"
              class="input"
              placeholder="如 /pages/some-page/index 或 https://example.com（可选）"
            />
          </view>
          <view class="form-item">
            <text class="label">排序</text>
            <input
              v-model.number="formData.orderIndex"
              class="input"
              type="number"
              placeholder="数字越小越靠前"
            />
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
          <button class="btn btn-outline" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="submitForm">确定</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  adminGetAnnouncements,
  adminAddAnnouncement,
  adminUpdateAnnouncement,
  adminDeleteAnnouncement,
  adminUploadAnnouncementImage
} from '@/api';

const loading = ref(true);
const announcements = ref<any[]>([]);

const showModal = ref(false);
const isEditMode = ref(false);
const editingId = ref<number | null>(null);
const uploadingImage = ref(false);
const formImageError = ref(false);

const formData = ref({
  title: '',
  description: '',
  content: '',
  imageUrl: '',
  linkUrl: '',
  orderIndex: 0,
  isActive: true
});

// 加载公告列表
const loadAnnouncements = async () => {
  try {
    loading.value = true;
    const res = await adminGetAnnouncements();
    announcements.value = res.announcements.map((a: any) => ({
      ...a,
      imageError: false
    }));
  } catch (error) {
    uni.showToast({ title: '加载公告列表失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

// 获取占位图URL
const getPlaceholderUrl = (id: number) => {
  return `https://picsum.photos/seed/announcement${id || Date.now()}/750/400.jpg`;
};

// 处理列表图片错误
const handleImageError = (item: any, event: any) => {
  item.imageError = true;
};

// 处理表单图片错误
const handleFormImageError = () => {
  formImageError.value = true;
};

// 选择图片
const chooseImage = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const filePath = res.tempFilePaths[0];
      await uploadImage(filePath);
    },
    fail: (error) => {
      console.error('选择图片失败', error);
      uni.showToast({ title: '选择图片失败', icon: 'none' });
    }
  });
};

// 上传图片
const uploadImage = async (filePath: string) => {
  try {
    uploadingImage.value = true;
    uni.showLoading({ title: '上传中...' });

    const res: any = await adminUploadAnnouncementImage(filePath);
    formData.value.imageUrl = res.imageUrl;
    formImageError.value = false;

    uni.hideLoading();
    uni.showToast({ title: '图片上传成功', icon: 'success' });
  } catch (error: any) {
    uni.hideLoading();
    uni.showToast({ title: error.error || '上传失败', icon: 'none' });
  } finally {
    uploadingImage.value = false;
  }
};

// 删除图片
const removeImage = () => {
  formData.value.imageUrl = '';
  formImageError.value = false;
};

// 打开添加弹窗
const openAddModal = () => {
  isEditMode.value = false;
  editingId.value = null;
  formImageError.value = false;
  formData.value = {
    title: '',
    description: '',
    content: '',
    imageUrl: '',
    linkUrl: '',
    orderIndex: 0,
    isActive: true
  };
  showModal.value = true;
};

// 编辑公告
const editAnnouncement = (item: any) => {
  isEditMode.value = true;
  editingId.value = item.id;
  formImageError.value = false;
  formData.value = {
    title: item.title,
    description: item.description || '',
    content: item.content || '',
    imageUrl: item.imageUrl,
    linkUrl: item.linkUrl || '',
    orderIndex: item.orderIndex,
    isActive: item.isActive
  };
  showModal.value = true;
};

// 删除公告
const deleteAnnouncement = (id: number) => {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除该公告吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '删除中...' });
          await adminDeleteAnnouncement(id);
          uni.hideLoading();
          uni.showToast({ title: '删除成功', icon: 'success' });
          loadAnnouncements();
        } catch (error: any) {
          uni.hideLoading();
          uni.showToast({ title: error.error || '删除失败', icon: 'none' });
        }
      }
    }
  });
};

// 提交表单
const submitForm = async () => {
  const { title, content, imageUrl } = formData.value;

  if (!title || !content || !imageUrl) {
    uni.showToast({ title: '请填写标题、主内容并上传图片', icon: 'none' });
    return;
  }

  try {
    uni.showLoading({ title: '提交中...' });

    if (isEditMode.value) {
      await adminUpdateAnnouncement(editingId.value!, formData.value);
    } else {
      await adminAddAnnouncement(formData.value);
    }

    uni.hideLoading();
    uni.showToast({ title: '操作成功', icon: 'success' });
    closeModal();
    loadAnnouncements();
  } catch (error: any) {
    uni.hideLoading();
    uni.showToast({ title: error.error || '操作失败', icon: 'none' });
  }
};

// 关闭弹窗
const closeModal = () => {
  showModal.value = false;
  isEditMode.value = false;
  editingId.value = null;
};

onMounted(() => {
  loadAnnouncements();
});
</script>

<style lang="scss" scoped>
.announcements-admin-container {
  min-height: 100vh;
  padding: 20rpx;
  background: #f5f5f5;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;

  .page-title {
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
  }

  .btn-add {
    display: flex;
    align-items: center;
    gap: 8rpx;
    padding: 16rpx 32rpx;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    font-size: 28rpx;
    border-radius: 12rpx;
    border: none;

    .add-icon {
      font-size: 36rpx;
      font-weight: bold;
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

.announcements-list {
  .announcement-card {
    background: #fff;
    border-radius: 16rpx;
    padding: 24rpx;
    margin-bottom: 16rpx;

    &:last-child {
      margin-bottom: 0;
    }
  }
}

.announcement-preview {
  display: flex;
  gap: 20rpx;
  margin-bottom: 20rpx;

  .preview-image {
    width: 200rpx;
    height: 150rpx;
    border-radius: 12rpx;
    background: #f3f4f6;
    flex-shrink: 0;
  }

  .preview-info {
    flex: 1;

    .preview-title {
      display: block;
      font-size: 30rpx;
      font-weight: bold;
      color: #333;
      margin-bottom: 8rpx;
    }

    .preview-desc {
      display: block;
      font-size: 26rpx;
      color: #6b7280;
      line-height: 1.4;
    }
  }
}

.announcement-actions {
  display: flex;
  gap: 12rpx;

  .btn-mini {
    flex: 1;
    padding: 16rpx;
    font-size: 26rpx;
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
  z-index: 1000;

  .modal-content {
    width: 650rpx;
    max-height: 85vh;
    background: #fff;
    border-radius: 24rpx;
    overflow: hidden;

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
      max-height: 55vh;
      overflow-y: auto;

      .form-item {
        margin-bottom: 24rpx;

        &:last-child {
          margin-bottom: 0;
        }

        .label {
          display: block;
          font-size: 28rpx;
          color: #333;
          margin-bottom: 12rpx;
          font-weight: 500;
        }

        .input,
        .textarea {
          width: 100%;
          border: 2rpx solid #e5e7eb;
          border-radius: 12rpx;
          padding: 24rpx;
          font-size: 30rpx;
          background: #f9fafb;
          color: #333;
          box-sizing: border-box;
          min-height: 88rpx;
          line-height: 1.4;
        }

        .textarea {
          min-height: 150rpx;
        }

        .content-textarea {
          min-height: 220rpx;
        }

        .char-count {
          display: block;
          text-align: right;
          font-size: 24rpx;
          color: #9ca3af;
          margin-top: 8rpx;
        }

        .hint {
          display: block;
          font-size: 24rpx;
          color: #9ca3af;
          margin-top: 8rpx;
        }

        .image-upload-section {
          .image-preview-wrapper {
            position: relative;
            width: 100%;
            height: 300rpx;
            border-radius: 12rpx;
            overflow: hidden;

            .image-preview {
              width: 100%;
              height: 100%;
            }

            .btn-remove-image {
              position: absolute;
              top: 16rpx;
              right: 16rpx;
              padding: 12rpx 24rpx;
              background: rgba(220, 38, 38, 0.9);
              color: #fff;
              font-size: 24rpx;
              border-radius: 8rpx;
              border: none;
            }
          }

          .btn-upload {
            width: 100%;
            height: 200rpx;
            border: 4rpx dashed #d1d5db;
            border-radius: 12rpx;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16rpx;
            background: #f9fafb;
            border: none;

            .upload-icon {
              font-size: 64rpx;
            }

            text {
              font-size: 28rpx;
              color: #6b7280;
            }
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
