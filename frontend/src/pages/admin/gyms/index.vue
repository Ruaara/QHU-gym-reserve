<template>
  <view class="admin-gyms-container">
    <!-- 添加健身房按钮 -->
    <view class="add-section">
      <button class="btn-add" @click="openAddModal">
        <text class="add-icon">+</text>
        <text>添加健身房</text>
      </button>
    </view>

    <!-- 健身房列表 -->
    <view v-if="loading" class="loading">
      <text>加载中...</text>
    </view>
    <view v-else-if="gyms.length === 0" class="empty-state">
      <text class="empty-text">暂无健身房</text>
    </view>
    <view v-else class="gyms-list">
      <view
        v-for="gym in gyms"
        :key="gym.id"
        class="gym-card"
      >
        <view class="gym-preview">
          <image :src="gym.imageUrl || defaultImage" class="preview-image" mode="aspectFill" />
          <view class="preview-info">
            <text class="preview-name">{{ gym.name }}</text>
            <text v-if="gym.description" class="preview-desc">{{ gym.description }}</text>
          </view>
        </view>
        <view class="gym-status">
          <text class="status-dot" :class="{ active: gym.isActive }"></text>
          <text class="status-text">{{ gym.isActive ? '启用中' : '已停用' }}</text>
        </view>
        <view class="gym-actions">
          <button class="btn-mini btn-edit" @click="editGym(gym)">编辑</button>
          <button class="btn-mini btn-delete" @click="deleteGym(gym.id)">删除</button>
        </view>
      </view>
    </view>

    <!-- 添加/编辑弹窗 -->
    <view v-if="showModal" class="modal-overlay" @click="closeModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ isEditMode ? '编辑健身房' : '添加健身房' }}</text>
          <text class="modal-close" @click="closeModal">×</text>
        </view>
        <view class="modal-body">
          <view class="form-item">
            <text class="label">名称 *</text>
            <input v-model="formData.name" class="input" placeholder="请输入健身房名称" />
          </view>
          <view class="form-item">
            <text class="label">描述</text>
            <textarea
              v-model="formData.description"
              class="textarea"
              placeholder="请输入健身房描述（可选）"
              maxlength="200"
            />
          </view>
          <view class="form-item">
            <text class="label">封面图片 *</text>
            <view class="image-upload-section">
              <view v-if="formData.imageUrl" class="image-preview-wrapper">
                <image :src="formData.imageUrl" class="image-preview" mode="aspectFill" />
                <button class="btn-remove-image" @click="removeImage">删除</button>
              </view>
              <button v-else class="btn-upload" @click="chooseImage">
                <text class="upload-icon">📷</text>
                <text>选择图片</text>
              </button>
            </view>
            <text class="hint">支持 JPG、PNG、GIF、WEBP 格式，最大 5MB</text>
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
  adminGetGyms,
  adminAddGym,
  adminUpdateGym,
  adminDeleteGym,
  adminUploadGymImage
} from '@/api';

const gyms = ref<any[]>([]);
const loading = ref(true);

const showModal = ref(false);
const isEditMode = ref(false);
const editingId = ref<number | null>(null);

const defaultImage = 'https://picsum.photos/seed/gym/400/400.jpg';

const formData = ref({
  name: '',
  description: '',
  imageUrl: '',
  isActive: true
});

// 加载健身房列表
const loadGyms = async () => {
  try {
    loading.value = true;
    const res = await adminGetGyms();
    gyms.value = res.gyms;
  } catch (error) {
    uni.showToast({ title: '加载健身房列表失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
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
    uni.showLoading({ title: '上传中...' });

    const res: any = await adminUploadGymImage(filePath);
    formData.value.imageUrl = res.imageUrl;

    uni.hideLoading();
    uni.showToast({ title: '图片上传成功', icon: 'success' });
  } catch (error: any) {
    uni.hideLoading();
    uni.showToast({ title: error.error || '上传失败', icon: 'none' });
  }
};

// 删除图片
const removeImage = () => {
  formData.value.imageUrl = '';
};

// 打开添加弹窗
const openAddModal = () => {
  isEditMode.value = false;
  editingId.value = null;
  formData.value = {
    name: '',
    description: '',
    imageUrl: '',
    isActive: true
  };
  showModal.value = true;
};

// 编辑健身房
const editGym = (gym: any) => {
  isEditMode.value = true;
  editingId.value = gym.id;
  formData.value = {
    name: gym.name,
    description: gym.description || '',
    imageUrl: gym.imageUrl || '',
    isActive: gym.isActive
  };
  showModal.value = true;
};

// 删除健身房
const deleteGym = (id: number) => {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除该健身房吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '删除中...' });
          await adminDeleteGym(id);
          uni.hideLoading();
          uni.showToast({ title: '删除成功', icon: 'success' });
          loadGyms();
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
  const { name, imageUrl } = formData.value;

  if (!name || !imageUrl) {
    uni.showToast({ title: '请填写名称并上传图片', icon: 'none' });
    return;
  }

  try {
    uni.showLoading({ title: '提交中...' });

    if (isEditMode.value) {
      await adminUpdateGym(editingId.value!, formData.value);
    } else {
      await adminAddGym(formData.value);
    }

    uni.hideLoading();
    uni.showToast({ title: '操作成功', icon: 'success' });
    closeModal();
    loadGyms();
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
  loadGyms();
});
</script>

<style lang="scss" scoped>
.admin-gyms-container {
  min-height: 100vh;
  padding: 20rpx;
  background: #f5f5f5;
}

.add-section {
  margin-bottom: 20rpx;

  .btn-add {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12rpx;
    width: 100%;
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
  .gym-card {
    background: #fff;
    border-radius: 16rpx;
    padding: 24rpx;
    margin-bottom: 16rpx;
  }

  .gym-preview {
    display: flex;
    gap: 20rpx;
    margin-bottom: 16rpx;

    .preview-image {
      width: 200rpx;
      height: 200rpx;
      border-radius: 12rpx;
      background: #f3f4f6;
      flex-shrink: 0;
    }

    .preview-info {
      flex: 1;

      .preview-name {
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

  .gym-status {
    display: flex;
    align-items: center;
    gap: 8rpx;
    margin-bottom: 16rpx;

    .status-dot {
      width: 16rpx;
      height: 16rpx;
      border-radius: 50%;
      background: #d1d5db;

      &.active {
        background: #10b981;
      }
    }

    .status-text {
      font-size: 24rpx;
      color: #6b7280;
    }
  }

  .gym-actions {
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
