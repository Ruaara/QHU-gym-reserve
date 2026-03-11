<template>
  <view class="admin-users-container">
    <!-- 搜索和添加 -->
    <view class="actions-section">
      <view class="search-box">
        <input
          v-model="searchKeyword"
          class="search-input"
          placeholder="搜索学号或姓名"
          @confirm="handleSearch"
        />
        <button class="btn-search" @click="handleSearch">搜索</button>
      </view>
      <view class="action-buttons">
        <button class="btn-action btn-add" @click="showAddModal = true">添加用户</button>
        <button class="btn-action btn-import" @click="handleImport">导入社团成员</button>
        <button v-if="userStore.isMainAdmin" class="btn-action btn-transfer" @click="showTransferModal = true">
          转移主管理员
        </button>
      </view>
    </view>

    <!-- 批量操作工具栏 -->
    <view v-if="selectedUserIds.length > 0" class="batch-toolbar">
      <view class="batch-info">
        <text class="batch-count">已选择 {{ selectedUserIds.length }} 个用户</text>
        <button class="btn-clear" @click="clearSelection">取消选择</button>
      </view>
      <view class="batch-actions">
        <button class="btn-batch btn-batch-ban" @click="batchOperation('ban')">封禁</button>
        <button class="btn-batch btn-batch-unban" @click="batchOperation('unban')">解封</button>
        <button class="btn-batch btn-batch-club" @click="batchOperation('setClub')">设为社团</button>
        <button class="btn-batch btn-batch-unclub" @click="batchOperation('removeClub')">取消社团</button>
        <button class="btn-batch btn-batch-free" @click="showBatchFreeReserveModal = true">免预约次数</button>
        <button class="btn-batch btn-batch-delete" @click="batchOperation('delete')">删除</button>
      </view>
    </view>

    <!-- 全选按钮 -->
    <view v-if="users.length > 0" class="select-all-bar">
      <checkbox
        :checked="isAllSelected"
        @click="toggleSelectAll"
        color="#667eea"
      />
      <text class="select-all-text">全选</text>
    </view>

    <!-- 用户列表 -->
    <view v-if="loading" class="loading">
      <text>加载中...</text>
    </view>
    <view v-else-if="users.length === 0" class="empty-state">
      <text class="empty-text">暂无用户</text>
    </view>
    <view v-else class="users-list">
      <view
        v-for="user in users"
        :key="user.id"
        class="user-card"
        :class="{ 'user-selected': selectedUserIds.includes(user.id) }"
      >
        <view class="user-checkbox">
          <checkbox
            :checked="selectedUserIds.includes(user.id)"
            @click="toggleSelectUser(user.id)"
            color="#667eea"
          />
        </view>
        <view class="user-content">
          <view class="user-header">
            <view class="user-info">
              <text class="user-name">{{ user.name }}</text>
              <text class="user-account">学号：{{ user.account }}</text>
              <text class="user-free-reserve">免预约次数：{{ user.freeReserveCount || 0 }}</text>
            </view>
            <view class="user-badges">
              <text v-if="user.role === 'main_admin'" class="badge badge-main-admin">主管理员</text>
              <text v-else-if="user.role === 'admin'" class="badge badge-admin">管理员</text>
              <text v-if="user.isClub" class="badge badge-club">社团</text>
              <text v-if="user.isBanned" class="badge badge-banned">已封禁</text>
            </view>
          </view>
          <view class="user-footer">
            <button
              v-if="user.role !== 'main_admin'"
              class="btn-mini"
              :class="{ 'btn-ban': !user.isBanned, 'btn-unban': user.isBanned }"
              @click="toggleBan(user)"
            >
              {{ user.isBanned ? '解封' : '封禁' }}
            </button>
            <button
              v-if="userStore.isMainAdmin && user.role !== 'main_admin'"
              class="btn-mini btn-role"
              @click="changeRole(user)"
            >
              {{ user.role === 'admin' ? '取消管理员' : '设为管理员' }}
            </button>
            <button
              v-if="!user.isClub && user.role !== 'main_admin'"
              class="btn-mini btn-club"
              @click="setClub(user, true)"
            >
              设为社团
            </button>
            <button
              v-if="user.isClub && user.role !== 'main_admin'"
              class="btn-mini btn-unclub"
              @click="setClub(user, false)"
            >
              取消社团
            </button>
            <button
              class="btn-mini btn-free-reserve"
              @click="setFreeReserve(user)"
            >
              免预约次数
            </button>
            <button
              v-if="user.role !== 'main_admin'"
              class="btn-mini btn-delete"
              @click="deleteUser(user)"
            >
              删除
            </button>
          </view>
        </view>
      </view>
    </view>

    <!-- 添加用户弹窗 -->
    <view v-if="showAddModal" class="modal-overlay" @click="closeAddModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">添加用户</text>
          <text class="modal-close" @click="closeAddModal">×</text>
        </view>
        <view class="modal-body">
          <view class="form-item">
            <text class="label">姓名</text>
            <input v-model="addForm.name" class="input" placeholder="请输入姓名" />
          </view>
          <view class="form-item">
            <text class="label">学号</text>
            <input v-model="addForm.account" class="input" placeholder="请输入学号" />
          </view>
          <view class="form-item">
            <text class="label">密码</text>
            <input v-model="addForm.password" class="input" placeholder="请输入密码" type="password" />
          </view>
          <view class="form-item">
            <view class="switch-container">
              <switch
                :checked="addForm.isClub"
                @change="addForm.isClub = $event.detail.value"
                color="#667eea"
              />
              <text class="switch-label">社团成员</text>
            </view>
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn btn-outline" @click="closeAddModal">取消</button>
          <button class="btn btn-primary" @click="submitAdd">确定</button>
        </view>
      </view>
    </view>

    <!-- 转移主管理员弹窗 -->
    <view v-if="showTransferModal" class="modal-overlay" @click="closeTransferModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">转移主管理员权限</text>
          <text class="modal-close" @click="closeTransferModal">×</text>
        </view>
        <view class="modal-body">
          <view class="warning-text">
            <text>⚠️ 此操作将把主管理员权限转移给其他用户，操作后您将成为普通管理员。</text>
          </view>
          <view class="form-item">
            <text class="label">目标用户账号</text>
            <input v-model="transferForm.account" class="input" placeholder="请输入目标用户的学号" />
          </view>
          <view class="form-item">
            <text class="label">您的密码</text>
            <input v-model="transferForm.password" class="input" placeholder="请输入您的密码确认" type="password" />
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn btn-outline" @click="closeTransferModal">取消</button>
          <button class="btn btn-danger" @click="submitTransfer">确认转移</button>
        </view>
      </view>
    </view>

    <!-- 设置免预约次数弹窗 -->
    <view v-if="showFreeReserveModal" class="modal-overlay" @click="closeFreeReserveModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">设置免预约次数</text>
          <text class="modal-close" @click="closeFreeReserveModal">×</text>
        </view>
        <view class="modal-body">
          <view class="form-item">
            <text class="label">用户</text>
            <input class="input" :value="freeReserveForm.userName" disabled />
          </view>
          <view class="form-item">
            <text class="label">免预约次数</text>
            <input v-model.number="freeReserveForm.count" class="input" type="number" placeholder="请输入次数" />
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn btn-outline" @click="closeFreeReserveModal">取消</button>
          <button class="btn btn-primary" @click="submitSetFreeReserve">确定</button>
        </view>
      </view>
    </view>

    <!-- 批量设置免预约次数弹窗 -->
    <view v-if="showBatchFreeReserveModal" class="modal-overlay" @click="closeBatchFreeReserveModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">批量设置免预约次数</text>
          <text class="modal-close" @click="closeBatchFreeReserveModal">×</text>
        </view>
        <view class="modal-body">
          <view class="form-item">
            <text class="label">已选择 {{ selectedUserIds.length }} 个用户</text>
          </view>
          <view class="form-item">
            <text class="label">免预约次数</text>
            <input v-model.number="batchFreeReserveCount" class="input" type="number" placeholder="请输入次数" />
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn btn-outline" @click="closeBatchFreeReserveModal">取消</button>
          <button class="btn btn-primary" @click="submitBatchFreeReserve">确定</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useUserStore } from '@/store/user';
import {
  adminGetUsers,
  adminAddUser,
  adminBanUser,
  adminSetUserRole,
  adminSetUserClub,
  adminImportClubMembers,
  adminTransferMain,
  adminSetFreeReserveCount,
  adminDeleteUser,
  adminBatchUpdateUsers
} from '@/api';

const userStore = useUserStore();

const users = ref<any[]>([]);
const loading = ref(true);
const searchKeyword = ref('');
const selectedUserIds = ref<number[]>([]);

const showAddModal = ref(false);
const addForm = ref({
  name: '',
  account: '',
  password: '',
  isClub: false
});

const showTransferModal = ref(false);
const transferForm = ref({
  account: '',
  password: ''
});

const showFreeReserveModal = ref(false);
const freeReserveForm = ref({
  userId: 0,
  userName: '',
  count: 0
});

const showBatchFreeReserveModal = ref(false);
const batchFreeReserveCount = ref(0);

// 全选状态
const isAllSelected = computed(() => {
  return users.value.length > 0 && selectedUserIds.value.length === users.value.length;
});

// 加载用户列表
const loadUsers = async (search?: string) => {
  try {
    loading.value = true;
    const res = await adminGetUsers(search);
    users.value = res.users;
  } catch (error) {
    uni.showToast({ title: '加载用户列表失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

// 搜索
const handleSearch = () => {
  selectedUserIds.value = [];
  loadUsers(searchKeyword.value);
};

// 选择/取消选择用户
const toggleSelectUser = (userId: number) => {
  const index = selectedUserIds.value.indexOf(userId);
  if (index > -1) {
    selectedUserIds.value.splice(index, 1);
  } else {
    selectedUserIds.value.push(userId);
  }
};

// 全选/取消全选
const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedUserIds.value = [];
  } else {
    selectedUserIds.value = users.value.map(u => u.id);
  }
};

// 清除选择
const clearSelection = () => {
  selectedUserIds.value = [];
};

// 批量操作
const batchOperation = async (action: string) => {
  if (selectedUserIds.value.length === 0) {
    uni.showToast({ title: '请选择要操作的用户', icon: 'none' });
    return;
  }

  let confirmMsg = '';
  let actionName = '';

  switch (action) {
    case 'delete':
      confirmMsg = `确定要删除选中的 ${selectedUserIds.value.length} 个用户吗？此操作不可恢复！`;
      actionName = '删除';
      break;
    case 'ban':
      confirmMsg = `确定要封禁选中的 ${selectedUserIds.value.length} 个用户吗？`;
      actionName = '封禁';
      break;
    case 'unban':
      confirmMsg = `确定要解封选中的 ${selectedUserIds.value.length} 个用户吗？`;
      actionName = '解封';
      break;
    case 'setClub':
      confirmMsg = `确定要将选中的 ${selectedUserIds.value.length} 个用户设为社团成员吗？`;
      actionName = '设为社团';
      break;
    case 'removeClub':
      confirmMsg = `确定要取消选中的 ${selectedUserIds.value.length} 个用户的社团成员资格吗？`;
      actionName = '取消社团';
      break;
    default:
      return;
  }

  uni.showModal({
    title: `确认${actionName}`,
    content: confirmMsg,
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '处理中...' });
          await adminBatchUpdateUsers({
            userIds: selectedUserIds.value,
            action: action
          });
          uni.hideLoading();
          uni.showToast({ title: `${actionName}成功`, icon: 'success' });
          selectedUserIds.value = [];
          loadUsers(searchKeyword.value);
        } catch (error: any) {
          uni.hideLoading();
          uni.showToast({ title: error.error || '操作失败', icon: 'none' });
        }
      }
    }
  });
};

// 删除单个用户
const deleteUser = async (user: any) => {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除用户 ${user.name}（${user.account}）吗？此操作不可恢复！`,
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '删除中...' });
          await adminDeleteUser(user.id);
          uni.hideLoading();
          uni.showToast({ title: '删除成功', icon: 'success' });
          loadUsers(searchKeyword.value);
        } catch (error: any) {
          uni.hideLoading();
          uni.showToast({ title: error.error || '删除失败', icon: 'none' });
        }
      }
    }
  });
};

// 封禁/解封用户
const toggleBan = async (user: any) => {
  const action = user.isBanned ? '解封' : '封禁';

  uni.showModal({
    title: `确认${action}`,
    content: `确定要${action}该用户吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '处理中...' });
          await adminBanUser(user.id, !user.isBanned);
          uni.hideLoading();
          uni.showToast({ title: `${action}成功`, icon: 'success' });
          loadUsers(searchKeyword.value);
        } catch (error: any) {
          uni.hideLoading();
          uni.showToast({ title: error.error || '操作失败', icon: 'none' });
        }
      }
    }
  });
};

// 修改用户角色
const changeRole = async (user: any) => {
  const newRole = user.role === 'admin' ? 'student' : 'admin';
  const action = newRole === 'admin' ? '设为管理员' : '取消管理员';

  uni.showModal({
    title: `确认${action}`,
    content: `确定要将该用户${action}吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '处理中...' });
          await adminSetUserRole(user.id, newRole);
          uni.hideLoading();
          uni.showToast({ title: `${action}成功`, icon: 'success' });
          loadUsers(searchKeyword.value);
        } catch (error: any) {
          uni.hideLoading();
          uni.showToast({ title: error.error || '操作失败', icon: 'none' });
        }
      }
    }
  });
};

// 设置社团成员状态
const setClub = async (user: any, isClub: boolean) => {
  const action = isClub ? '设为社团成员' : '取消社团成员';

  uni.showModal({
    title: `确认${action}`,
    content: `确定要将该用户${action}吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '处理中...' });
          await adminSetUserClub(user.id, isClub);
          uni.hideLoading();
          uni.showToast({ title: `${action}成功`, icon: 'success' });
          loadUsers(searchKeyword.value);
        } catch (error: any) {
          uni.hideLoading();
          uni.showToast({ title: error.error || '操作失败', icon: 'none' });
        }
      }
    }
  });
};

// 导入社团成员
const handleImport = () => {
  uni.chooseFile({
    count: 1,
    extension: ['.xlsx', '.xls'],
    success: async (res: any) => {
      try {
        uni.showLoading({ title: '导入中...' });
        await adminImportClubMembers(res.tempFilePaths[0]);
        uni.hideLoading();
        uni.showToast({ title: '导入成功', icon: 'success' });
        loadUsers(searchKeyword.value);
      } catch (error: any) {
        uni.hideLoading();
        uni.showToast({ title: error.error || '导入失败', icon: 'none' });
      }
    }
  });
};

// 提交添加用户
const submitAdd = async () => {
  if (!addForm.value.name || !addForm.value.account || !addForm.value.password) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' });
    return;
  }

  try {
    uni.showLoading({ title: '添加中...' });
    await adminAddUser(addForm.value);
    uni.hideLoading();
    uni.showToast({ title: '添加成功', icon: 'success' });
    closeAddModal();
    loadUsers(searchKeyword.value);
  } catch (error: any) {
    uni.hideLoading();
    uni.showToast({ title: error.error || '添加失败', icon: 'none' });
  }
};

// 关闭添加弹窗
const closeAddModal = () => {
  showAddModal.value = false;
  addForm.value = {
    name: '',
    account: '',
    password: '',
    isClub: false
  };
};

// 提交转移主管理员
const submitTransfer = async () => {
  if (!transferForm.value.account || !transferForm.value.password) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' });
    return;
  }

  uni.showModal({
    title: '确认转移',
    content: `确定要将主管理员权限转移给账号 ${transferForm.value.account} 吗？此操作不可撤销！`,
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '转移中...' });
          await adminTransferMain(transferForm.value);
          uni.hideLoading();
          uni.showToast({ title: '转移成功', icon: 'success' });
          closeTransferModal();
          await userStore.fetchUser();
          loadUsers(searchKeyword.value);
        } catch (error: any) {
          uni.hideLoading();
          uni.showToast({ title: error.error || '转移失败', icon: 'none' });
        }
      }
    }
  });
};

// 关闭转移弹窗
const closeTransferModal = () => {
  showTransferModal.value = false;
  transferForm.value = {
    account: '',
    password: ''
  };
};

// 设置免预约次数
const setFreeReserve = (user: any) => {
  freeReserveForm.value = {
    userId: user.id,
    userName: user.name,
    count: user.freeReserveCount || 0
  };
  showFreeReserveModal.value = true;
};

// 提交设置免预约次数
const submitSetFreeReserve = async () => {
  try {
    uni.showLoading({ title: '设置中...' });
    await adminSetFreeReserveCount(freeReserveForm.value.userId, freeReserveForm.value.count);
    uni.hideLoading();
    uni.showToast({ title: '设置成功', icon: 'success' });
    closeFreeReserveModal();
    loadUsers(searchKeyword.value);
  } catch (error: any) {
    uni.hideLoading();
    uni.showToast({ title: error.error || '设置失败', icon: 'none' });
  }
};

// 关闭免预约次数弹窗
const closeFreeReserveModal = () => {
  showFreeReserveModal.value = false;
  freeReserveForm.value = {
    userId: 0,
    userName: '',
    count: 0
  };
};

// 提交批量设置免预约次数
const submitBatchFreeReserve = async () => {
  if (isNaN(batchFreeReserveCount.value) || batchFreeReserveCount.value < 0 || batchFreeReserveCount.value > 999) {
    uni.showToast({ title: '免预约次数必须在0-999之间', icon: 'none' });
    return;
  }

  try {
    uni.showLoading({ title: '设置中...' });
    await adminBatchUpdateUsers({
      userIds: selectedUserIds.value,
      action: 'setFreeReserve',
      value: batchFreeReserveCount.value
    });
    uni.hideLoading();
    uni.showToast({ title: '设置成功', icon: 'success' });
    closeBatchFreeReserveModal();
    selectedUserIds.value = [];
    loadUsers(searchKeyword.value);
  } catch (error: any) {
    uni.hideLoading();
    uni.showToast({ title: error.error || '设置失败', icon: 'none' });
  }
};

// 关闭批量设置免预约次数弹窗
const closeBatchFreeReserveModal = () => {
  showBatchFreeReserveModal.value = false;
  batchFreeReserveCount.value = 0;
};

onMounted(() => {
  loadUsers();
});
</script>

<style lang="scss" scoped>
.admin-users-container {
  min-height: 100vh;
  padding: 20rpx;
  padding-bottom: 120rpx;
  background: #f5f5f5;
}

.actions-section {
  margin-bottom: 20rpx;

  .search-box {
    display: flex;
    gap: 12rpx;
    margin-bottom: 16rpx;

    .search-input {
      flex: 1;
      height: 72rpx;
      padding: 0 24rpx;
      border: 2rpx solid #e5e7eb;
      border-radius: 12rpx;
      font-size: 28rpx;
      background: #fff;
    }

    .btn-search {
      padding: 0 32rpx;
      height: 72rpx;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      font-size: 28rpx;
      border-radius: 12rpx;
      border: none;
    }
  }

  .action-buttons {
    display: flex;
    gap: 12rpx;

    .btn-action {
      flex: 1;
      height: 72rpx;
      font-size: 26rpx;
      border-radius: 12rpx;
      border: none;

      &.btn-add {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
      }

      &.btn-import {
        background: #fef3c7;
        color: #d97706;
      }

      &.btn-transfer {
        background: #fee2e2;
        color: #dc2626;
      }
    }
  }
}

.batch-toolbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  border-top: 2rpx solid #e5e7eb;
  padding: 20rpx;
  z-index: 100;

  .batch-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16rpx;

    .batch-count {
      font-size: 28rpx;
      font-weight: bold;
      color: #333;
    }

    .btn-clear {
      padding: 8rpx 20rpx;
      font-size: 24rpx;
      color: #6b7280;
      background: #f3f4f6;
      border-radius: 8rpx;
      border: none;
    }
  }

  .batch-actions {
    display: flex;
    gap: 12rpx;
    overflow-x: auto;

    .btn-batch {
      flex-shrink: 0;
      padding: 16rpx 24rpx;
      font-size: 24rpx;
      border-radius: 8rpx;
      border: none;

      &.btn-batch-ban {
        background: #fee2e2;
        color: #dc2626;
      }

      &.btn-batch-unban {
        background: #d1fae5;
        color: #059669;
      }

      &.btn-batch-club {
        background: #d1fae5;
        color: #059669;
      }

      &.btn-batch-unclub {
        background: #fef3c7;
        color: #d97706;
      }

      &.btn-batch-free {
        background: #dbeafe;
        color: #2563eb;
      }

      &.btn-batch-delete {
        background: #dc2626;
        color: #fff;
      }
    }
  }
}

.select-all-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 20rpx;
  background: #fff;
  border-radius: 12rpx;
  margin-bottom: 16rpx;

  .select-all-text {
    font-size: 28rpx;
    color: #333;
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

.users-list {
  .user-card {
    display: flex;
    background: #fff;
    border-radius: 16rpx;
    padding: 24rpx;
    margin-bottom: 16rpx;
    border: 3rpx solid transparent;
    transition: all 0.3s;

    &.user-selected {
      border-color: #667eea;
      background: #f0f4ff;
    }

    .user-checkbox {
      margin-right: 16rpx;
      display: flex;
      align-items: flex-start;
      padding-top: 8rpx;
    }

    .user-content {
      flex: 1;
    }

    .user-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16rpx;

      .user-info {
        .user-name {
          display: block;
          font-size: 32rpx;
          font-weight: bold;
          color: #333;
          margin-bottom: 8rpx;
        }

        .user-account {
          display: block;
          font-size: 26rpx;
          color: #6b7280;
        }

        .user-free-reserve {
          display: block;
          font-size: 24rpx;
          color: #dc2626;
          margin-top: 4rpx;
          font-weight: 500;
        }
      }

      .user-badges {
        display: flex;
        gap: 8rpx;

        .badge {
          padding: 6rpx 16rpx;
          font-size: 22rpx;
          border-radius: 8rpx;

          &.badge-main-admin {
            background: #fef3c7;
            color: #d97706;
          }

          &.badge-admin {
            background: #dbeafe;
            color: #2563eb;
          }

          &.badge-club {
            background: #d1fae5;
            color: #059669;
          }

          &.badge-banned {
            background: #fee2e2;
            color: #dc2626;
          }
        }
      }
    }

    .user-footer {
      display: flex;
      flex-wrap: wrap;
      gap: 12rpx;
      padding-top: 16rpx;
      border-top: 2rpx solid #f3f4f6;

      .btn-mini {
        padding: 12rpx 24rpx;
        font-size: 24rpx;
        border-radius: 8rpx;
        border: none;

        &.btn-ban {
          background: #fee2e2;
          color: #dc2626;
        }

        &.btn-unban {
          background: #d1fae5;
          color: #059669;
        }

        &.btn-role {
          background: #dbeafe;
          color: #2563eb;
        }

        &.btn-club {
          background: #d1fae5;
          color: #059669;
        }

        &.btn-unclub {
          background: #fef3c7;
          color: #d97706;
        }

        &.btn-free-reserve {
          background: #fee2e2;
          color: #dc2626;
        }

        &.btn-delete {
          background: #dc2626;
          color: #fff;
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
  pointer-events: none;

  .modal-content {
    width: 600rpx;
    max-height: 80vh;
    background: #fff;
    border-radius: 24rpx;
    overflow: hidden;
    position: relative;
    z-index: 1000;
    pointer-events: auto;

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

      .warning-text {
        padding: 20rpx;
        background: #fef3c7;
        border-radius: 12rpx;
        margin-bottom: 24rpx;
        font-size: 26rpx;
        color: #d97706;
        line-height: 1.5;
      }

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
        }

        .input {
          width: 100%;
          height: 80rpx;
          padding: 0 24rpx;
          border: 2rpx solid #e5e7eb;
          border-radius: 12rpx;
          font-size: 28rpx;
          background: #f9fafb;
          box-sizing: border-box;
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

        &.btn-danger {
          background: #dc2626;
          color: #fff;
        }
      }
    }
  }
}
</style>
