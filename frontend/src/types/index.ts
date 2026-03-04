// 用户类型
export interface User {
  id: number;
  name: string;
  account: string;
  role: 'student' | 'admin' | 'main_admin';
  isClub: boolean;
  isBanned: boolean;
}

// 健身房类型
export interface Gym {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

// 时间段类型
export interface TimeSlot {
  id: number;
  gymId: number;
  gymName: string;
  startTime: string;
  endTime: string;
  isClubOnly: boolean;
  maxCapacity: number;
  availableSlots?: number;
  isActive: boolean;
}

// 预约记录类型
export interface Reservation {
  id: number;
  gymName: string;
  startTime: string;
  endTime: string;
  reservationDate: string;
  createdAt: string;
  todayChange?: number; // 今日剩余变更次数
}

// 预约限制状态类型
export interface ReservationLimitStatus {
  today_reserved: boolean;
  today_change: number;
}

// API 响应类型
export interface ApiResponse<T = any> {
  message?: string;
  data?: T;
  error?: string;
}

// 登录响应类型
export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

// 分页响应类型
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
