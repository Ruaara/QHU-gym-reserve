# QHU 健身房预约系统

青海大学健身房预约小程序系统，支持学生预约健身房、管理员管理场地和用户等功能。

## 技术栈

### 后端
- Node.js + Express + TypeScript
- SQLite (better-sqlite3)
- JWT 认证
- bcryptjs 密码加密

### 前端
- uni-app (Vue 3 + TypeScript)
- Pinia 状态管理
- H5 模式开发调试
- 微信小程序部署

## 项目结构

```
QHU-gym-reserve/
├── backend/           # Express 后端
│   ├── src/
│   │   ├── routes/    # 路由
│   │   ├── controllers/ # 控制器
│   │   ├── middleware/ # 中间件
│   │   ├── database/  # 数据库
│   │   ├── utils/     # 工具函数
│   │   └── index.ts   # 入口文件
│   ├── package.json
│   └── tsconfig.json
├── frontend/          # uni-app 前端
│   ├── src/
│   │   ├── pages/     # 页面
│   │   ├── api/       # API 调用
│   │   ├── store/     # Pinia 状态管理
│   │   ├── utils/     # 工具函数
│   │   ├── types/     # 类型定义
│   │   └── styles/    # 样式
│   └── package.json
└── README.md
```

## 安装和运行

### 1. 安装依赖

```bash
# 安装后端依赖
cd backend
pnpm install

# 安装前端依赖
cd ../frontend
pnpm install
```

### 2. 初始化数据库

```bash
cd backend
pnpm run db:init
```

这将创建 SQLite 数据库并初始化：
- 主管理员账号：`17722657032` / `psammead`
- 默认健身房：新健身房、旧健身房

### 3. 启动后端服务

```bash
cd backend
pnpm run dev
```

后端将在 `http://localhost:3000` 运行

### 4. 启动前端（H5 模式）

```bash
cd frontend
pnpm run dev:h5
```

前端将在 `http://localhost:5173` 运行

### 5. 访问应用

在浏览器中打开 `http://localhost:5173` 即可访问应用。

## 默认账号

### 主管理员
- 账号：`17722657032`
- 密码：`psammead`
- 权限：所有功能

### 功能说明

### 学生功能
- 注册/登录
- 查看健身房列表
- 查看可预约时间段
- 创建预约
- 查看我的预约
- 取消预约

### 管理员功能
- 健身房管理（添加/编辑/删除）
- 时间段管理（添加/编辑/删除）
- 用户管理（添加/封禁/搜索）

### 主管理员功能
- 授权/取消管理员
- 转移主管理员权限
- 批量导入社团成员（Excel）

## API 接口

### 认证
- POST `/api/auth/register` - 用户注册
- POST `/api/auth/login` - 用户登录
- GET `/api/auth/me` - 获取当前用户信息

### 健身房
- GET `/api/gyms` - 获取健身房列表

### 时间段
- GET `/api/time-slots?gymId=X&date=Y` - 获取时间段

### 预约
- POST `/api/reservations` - 创建预约
- GET `/api/reservations/my?date=Y` - 获取我的预约
- DELETE `/api/reservations/:id` - 取消预约

### 管理员
- GET `/api/admin/users` - 获取用户列表
- POST `/api/admin/users` - 添加用户
- PUT `/api/admin/users/:id/ban` - 封禁/解封用户
- POST `/api/admin/users/import-club` - 批量导入社团成员
- PUT `/api/admin/users/:id/role` - 设置用户角色
- GET `/api/admin/gyms` - 获取健身房管理列表
- POST `/api/admin/gyms` - 添加健身房
- PUT `/api/admin/gyms/:id` - 修改健身房
- DELETE `/api/admin/gyms/:id` - 删除健身房
- GET `/api/admin/time-slots` - 获取时间段管理列表
- POST `/api/admin/time-slots` - 添加时间段
- PUT `/api/admin/time-slots/:id` - 修改时间段
- DELETE `/api/admin/time-slots/:id` - 删除时间段
- POST `/api/admin/transfer-main` - 转移主管理员权限

## 部署

### 后端部署
1. 使用 `pnpm run build` 构建后端
2. 使用 PM2 启动服务：`pm2 start dist/index.js`
3. 配置 Nginx 反向代理

### 前端部署
1. H5：运行 `pnpm run build:h5`，将 `dist/build/h5` 目录部署到服务器
2. 微信小程序：运行 `pnpm run build:mp-weixin`，将 `dist/build/mp-weixin` 目录导入微信开发者工具

## 注意事项

1. 生产环境请修改 `.env` 文件中的 `JWT_SECRET`
2. 微信小程序需要修改 `frontend/src/utils/request.ts` 中的 `BASE_URL`
3. Excel 导入功能仅支持 `.xlsx` 和 `.xls` 格式，第一列应为学号

## 开发环境

- Node.js >= 18
- pnpm >= 8
