import { get, post, put, del } from '../utils/request';
import type { User, LoginResponse, Gym, TimeSlot, Reservation, ReservationLimitStatus } from '../types';

// ========== 认证相关 ==========

// 用户注册
export const register = (data: { name: string; account: string; password: string }) => {
  return post<LoginResponse>('/auth/register', data);
};

// 用户登录
export const login = (data: { account: string; password: string }) => {
  return post<LoginResponse>('/auth/login', data);
};

// 获取当前用户信息
export const getCurrentUser = () => {
  return get<User>('/auth/me');
};

// ========== 健身房相关 ==========

// 获取健身房列表
export const getGyms = () => {
  return get<{ gyms: Gym[] }>('/gyms');
};

// ========== 时间段相关 ==========

// 获取时间段列表
export const getTimeSlots = (gymId: number, date?: string) => {
  return get<{ timeSlots: TimeSlot[] }>(`/time-slots?gymId=${gymId}${date ? `&date=${date}` : ''}`);
};

// ========== 预约相关 ==========

// 创建预约
export const createReservation = (data: { gymId: number; timeSlotId: number; reservationDate: string; useFreeReserve?: boolean }) => {
  return post<{ message: string; reservation: Reservation }>('/reservations', data);
};

// 获取我的预约
export const getMyReservations = (date?: string) => {
  return get<{ reservations: Reservation[] }>(`/reservations/my${date ? `?date=${date}` : ''}`);
};

// 取消预约
export const cancelReservation = (id: number) => {
  return del<{ message: string }>(`/reservations/${id}`);
};

// 获取预约限制状态
export const getReservationLimitStatus = () => {
  return get<ReservationLimitStatus>('/reservations/limit-status');
};

// 检查日期是否可预约
export const checkDateAvailability = (date: string) => {
  return get<{ date: string; canReserve: boolean; message: string }>(`/reservations/check-date?date=${date}`);
};

// 修改密码
export const changePasswordApi = (data: { oldPassword: string; newPassword: string }) => {
  return post<{ message: string }>('/auth/change-password', data);
};

// ========== 管理员相关 ==========

// 获取用户列表
export const adminGetUsers = (search?: string) => {
  return get<{ users: any[] }>(`/admin/users${search ? `?search=${search}` : ''}`);
};

// 添加用户
export const adminAddUser = (data: { name: string; account: string; password: string; isClub: boolean }) => {
  return post<{ message: string }>('/admin/users', data);
};

// 封禁/解封用户
export const adminBanUser = (id: number, isBanned: boolean) => {
  return put<{ message: string }>(`/admin/users/${id}/ban`, { isBanned });
};

// 批量导入社团成员
export const adminImportClubMembers = (filePath: string) => {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${import.meta.env.DEV ? '/api' : 'http://your-server-url:3000/api'}/admin/users/import-club`,
      filePath,
      name: 'file',
      header: {
        'Authorization': `Bearer ${uni.getStorageSync('token') || ''}`
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(res.data));
        } else {
          reject(JSON.parse(res.data));
        }
      },
      fail: reject
    });
  });
};

// 设置用户角色
export const adminSetUserRole = (id: number, role: 'student' | 'admin') => {
  return put<{ message: string }>(`/admin/users/${id}/role`, { role });
};

// 设置用户社团成员状态
export const adminSetUserClub = (id: number, isClub: boolean) => {
  return put<{ message: string }>(`/admin/users/${id}/club`, { isClub });
};

// 设置用户免预约次数
export const adminSetFreeReserveCount = (id: number, count: number) => {
  return put<{ message: string; freeReserveCount: number }>(`/admin/users/${id}/free-reserve-count`, { count });
};

// 删除用户
export const adminDeleteUser = (id: number) => {
  return del<{ message: string }>(`/admin/users/${id}`);
};

// 批量操作用户
export const adminBatchUpdateUsers = (data: { userIds: number[]; action: string; value?: string | number }) => {
  return post<{ message: string; successCount: number }>('/admin/users/batch', data);
};

// 获取健身房管理列表
export const adminGetGyms = () => {
  return get<{ gyms: Gym[] }>('/admin/gyms');
};

// 上传健身房图片
export const adminUploadGymImage = (filePath: string) => {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${import.meta.env.DEV ? '/api' : 'http://your-server-url:3000/api'}/admin/gyms/upload-image`,
      filePath,
      name: 'image',
      header: {
        'Authorization': `Bearer ${uni.getStorageSync('token') || ''}`
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(res.data));
        } else {
          reject(JSON.parse(res.data));
        }
      },
      fail: reject
    });
  });
};

// 添加健身房
export const adminAddGym = (data: { name: string; description: string; imageUrl: string }) => {
  return post<{ message: string }>('/admin/gyms', data);
};

// 修改健身房
export const adminUpdateGym = (id: number, data: { name: string; description: string; imageUrl: string; isActive: boolean }) => {
  return put<{ message: string }>(`/admin/gyms/${id}`, data);
};

// 删除健身房
export const adminDeleteGym = (id: number) => {
  return del<{ message: string }>(`/admin/gyms/${id}`);
};

// 获取时间段管理列表
export const adminGetTimeSlots = () => {
  return get<{ timeSlots: any[] }>('/admin/time-slots');
};

// 添加时间段
export const adminAddTimeSlot = (data: {
  gymId: number;
  startTime: string;
  endTime: string;
  isClubOnly: boolean;
  maxCapacity: number;
  daysAvailable?: number[];
  bookingOpenTime?: string;
}) => {
  return post<{ message: string }>('/admin/time-slots', data);
};

// 修改时间段
export const adminUpdateTimeSlot = (id: number, data: {
  startTime: string;
  endTime: string;
  isClubOnly: boolean;
  maxCapacity: number;
  isActive: boolean;
  daysAvailable?: number[];
  bookingOpenTime?: string;
}) => {
  return put<{ message: string }>(`/admin/time-slots/${id}`, data);
};

// 删除时间段
export const adminDeleteTimeSlot = (id: number) => {
  return del<{ message: string }>(`/admin/time-slots/${id}`);
};

// 转移主管理员权限
export const adminTransferMain = (data: { account: string; password: string }) => {
  return post<{ message: string }>('/admin/transfer-main', data);
};

// 获取预约开放时间
export const adminGetBookingOpenTime = () => {
  return get<{ bookingOpenTime: string }>('/admin/booking-open-time');
};

// 设置预约开放时间
export const adminSetBookingOpenTime = (bookingOpenTime: string) => {
  return put<{ message: string }>('/admin/booking-open-time', { bookingOpenTime });
};

// ========== 公告相关 ==========

// 获取公告列表
export const getAnnouncements = () => {
  return get<{ announcements: any[] }>('/announcements');
};

// 管理员获取所有公告
export const adminGetAnnouncements = () => {
  return get<{ announcements: any[] }>('/announcements/admin');
};

// 上传公告图片
export const adminUploadAnnouncementImage = (filePath: string) => {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${import.meta.env.DEV ? '/api' : 'http://your-server-url:3000/api'}/announcements/admin/upload-image`,
      filePath,
      name: 'image',
      header: {
        'Authorization': `Bearer ${uni.getStorageSync('token') || ''}`
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(res.data));
        } else {
          reject(JSON.parse(res.data));
        }
      },
      fail: reject
    });
  });
};

// 添加公告
export const adminAddAnnouncement = (data: {
  title: string;
  description: string;
  content: string;
  imageUrl: string;
  linkUrl: string;
  orderIndex: number;
}) => {
  return post<{ message: string }>('/announcements/admin', data);
};

// 修改公告
export const adminUpdateAnnouncement = (id: number, data: {
  title: string;
  description: string;
  content: string;
  imageUrl: string;
  linkUrl: string;
  orderIndex: number;
  isActive: boolean;
}) => {
  return put<{ message: string }>(`/announcements/admin/${id}`, data);
};

// 删除公告
export const adminDeleteAnnouncement = (id: number) => {
  return del<{ message: string }>(`/announcements/admin/${id}`);
};

// ========== 二维码相关 ==========

// 获取我的二维码（今日预约）
export const getMyQrCode = () => {
  return get<{
    reservation: {
      id: number;
      gymName: string;
      startTime: string;
      endTime: string;
      date: string;
    };
    qrCodeData: string;
    qrCodeImage: string;
    isUsed: boolean;
  }>('/qrcodes/my-qrcode');
};

// 验证二维码（管理员扫一扫）
export const verifyQrCode = (qrCodeData: string) => {
  return post<{ message: string; userName: string; userAccount: string; reservationDate: string }>('/qrcodes/verify', { qrCodeData });
};

// ========== 系统设置相关 ==========

// 获取系统设置
export const getSystemSettings = () => {
  return get<{ settings: Record<string, { value: string; description: string }> }>('/settings');
};

// 更新系统设置
export const updateSystemSettings = (settings: Record<string, string>) => {
  return put<{ message: string }>('/settings', { settings });
};
