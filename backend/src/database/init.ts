import initSqlJs, { Database } from 'sql.js';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

export const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'database.db');

let db: Database | null = null;
let dbPromiseInstance: Promise<Database> | null = null;
let dbInstanceId = 0;

// 加载或创建数据库
export const getDatabase = async (): Promise<Database> => {
  // If we already have a database instance, return it
  if (db) return db;

  // If we have a pending promise, return it
  if (dbPromiseInstance) return dbPromiseInstance;

  // Create a new promise to initialize the database
  dbPromiseInstance = (async () => {
    const SQL = await initSqlJs();

    // 尝试加载现有数据库
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      // 创建新数据库
      db = new SQL.Database();
      // Don't call saveDatabase here as it will cause infinite recursion with logging
    }

    // 启用外键约束
    db.run('PRAGMA foreign_keys = ON');

    // Set instance ID
    dbInstanceId++;
    (db as any).__instanceId = dbInstanceId;
    console.log(`[getDatabase] Created DB instance #${dbInstanceId}`);

    return db;
  })();

  return dbPromiseInstance;
};

// 保存数据库到文件
export const saveDatabase = () => {
  if (db) {
    // Log database state and instance ID
    const resCount = db.exec('SELECT COUNT(*) FROM reservations')[0]?.values[0]?.[0] || 0;
    const limCount = db.exec('SELECT COUNT(*) FROM reservation_limits')[0]?.values[0]?.[0] || 0;
    const dbId = (db as any).__instanceId || 'unknown';

    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    const msg = `[saveDatabase] DB instance #${dbId}, Saved ${resCount} reservations, ${limCount} limits to ${DB_PATH} at ${new Date().toISOString()}`;
    console.log(msg);
    fs.appendFileSync('/tmp/save_database.log', msg + '\n');
  } else {
    console.log('[saveDatabase] No database instance to save');
    fs.appendFileSync('/tmp/save_database.log', '[saveDatabase] No database instance\n');
  }
};

// 创建用户表
export const createUsersTable = async () => {
  const database = await getDatabase();
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(50) NOT NULL,
      account VARCHAR(20) UNIQUE NOT NULL,
      password VARCHAR(100) NOT NULL,
      is_club BOOLEAN DEFAULT 0,
      is_banned BOOLEAN DEFAULT 0,
      role VARCHAR(10) DEFAULT 'student',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  database.run(sql);
  console.log('✅ Users table created');
};

// 创建健身房表
export const createGymsTable = async () => {
  const database = await getDatabase();
  const sql = `
    CREATE TABLE IF NOT EXISTS gyms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(50) NOT NULL,
      description TEXT,
      image_url TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  database.run(sql);
  console.log('✅ Gyms table created');

  // 添加 image_url 字段（如果不存在）
  try {
    database.run('ALTER TABLE gyms ADD COLUMN image_url TEXT');
    console.log('ℹ️  image_url column added to gyms table');
  } catch (e) {
    // 字段已存在，忽略错误
  }
};

// 创建时间段表
export const createTimeSlotsTable = async () => {
  const database = await getDatabase();
  const sql = `
    CREATE TABLE IF NOT EXISTS time_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gym_id INTEGER NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      is_club_only BOOLEAN DEFAULT 0,
      max_capacity INTEGER NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      days_available VARCHAR(20) DEFAULT '1,2,3,4,5,6,7',
      booking_open_time VARCHAR(5) DEFAULT '20:00',
      FOREIGN KEY (gym_id) REFERENCES gyms(id)
    )
  `;
  database.run(sql);
  console.log('✅ Time slots table created');

  // 添加 days_available 字段（如果不存在）
  try {
    database.run('ALTER TABLE time_slots ADD COLUMN days_available VARCHAR(20) DEFAULT "1,2,3,4,5,6,7"');
    console.log('ℹ️  days_available column added to time_slots table');
  } catch (e) {
    // 字段已存在，忽略错误
  }

  // 添加 booking_open_time 字段（如果不存在）
  try {
    database.run('ALTER TABLE time_slots ADD COLUMN booking_open_time VARCHAR(5) DEFAULT "20:00"');
    console.log('ℹ️  booking_open_time column added to time_slots table');
  } catch (e) {
    // 字段已存在，忽略错误
  }
};

// 创建预约记录表
export const createReservationsTable = async () => {
  const database = await getDatabase();
  const sql = `
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      gym_id INTEGER NOT NULL,
      time_slot_id INTEGER NOT NULL,
      reservation_date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (gym_id) REFERENCES gyms(id),
      FOREIGN KEY (time_slot_id) REFERENCES time_slots(id),
      UNIQUE(user_id, time_slot_id, reservation_date)
    )
  `;
  database.run(sql);
  console.log('✅ Reservations table created');
};

// 初始化主管理员账号
export const initMainAdmin = async () => {
  const database = await getDatabase();
  const mainAdminAccount = '17722657032';
  const mainAdminPassword = 'psammead';

  // 检查主管理员是否已存在
  const stmt = database.prepare('SELECT id FROM users WHERE account = :account');
  const result = stmt.getAsObject({ ':account': mainAdminAccount }) as any;

  if (!result || !result.id) {
    const hashedPassword = bcrypt.hashSync(mainAdminPassword, 10);
    const insertStmt = database.prepare(`
      INSERT INTO users (name, account, password, role, is_club)
      VALUES (:name, :account, :password, :role, 1)
    `);
    insertStmt.run({
      ':name': '主管理员',
      ':account': mainAdminAccount,
      ':password': hashedPassword,
      ':role': 'main_admin'
    });
    console.log('✅ Main admin account created');
  } else {
    console.log('ℹ️  Main admin account already exists');
    // 确保主管理员是社团成员
    const updateStmt = database.prepare('UPDATE users SET is_club = 1 WHERE account = :account');
    updateStmt.run({ ':account': mainAdminAccount });
    console.log('ℹ️  Main admin set as club member');
  }
};

// 初始化默认健身房数据
export const initDefaultGyms = async () => {
  const database = await getDatabase();
  const stmt = database.prepare('SELECT COUNT(*) as count FROM gyms');
  const result = stmt.getAsObject({}) as { count: number };

  if (result.count === 0) {
    const insertStmt = database.prepare(`
      INSERT INTO gyms (name, description) VALUES (:name, :description)
    `);
    insertStmt.run({ ':name': '新健身房', ':description': '新装修的健身房，设备齐全' });
    insertStmt.run({ ':name': '旧健身房', ':description': '经典健身房，场地宽敞' });
    console.log('✅ Default gyms created');
  } else {
    console.log('ℹ️  Gyms already exist');
  }
};

// 创建预约限制表
export const createReservationLimitsTable = async () => {
  const database = await getDatabase();
  const sql = `
    CREATE TABLE IF NOT EXISTS reservation_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      today_reserved BOOLEAN DEFAULT 0,
      today_change INTEGER DEFAULT 1,
      last_reset_date DATE NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `;
  database.run(sql);
  console.log('✅ Reservation limits table created');
};

// 创建二维码表
export const createQrCodesTable = async () => {
  const database = await getDatabase();
  const sql = `
    CREATE TABLE IF NOT EXISTS qr_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      reservation_id INTEGER NOT NULL,
      qr_code_data VARCHAR(255) NOT NULL UNIQUE,
      is_used BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (reservation_id) REFERENCES reservations(id)
    )
  `;
  database.run(sql);
  console.log('✅ QR codes table created');
};

// 添加 unfaith_count 字段到用户表（如果不存在）
export const addUnfaithCountColumn = async () => {
  const database = await getDatabase();

  // 检查列是否已存在
  const checkStmt = database.prepare('PRAGMA table_info(users)');
  const result = [] as any[];
  while (checkStmt.step()) {
    const row = checkStmt.getAsObject() as any;
    result.push(row);
  }
  const hasUnfaithCount = result.some((col: any) => col.name === 'unfaith_count');

  if (!hasUnfaithCount) {
    database.run('ALTER TABLE users ADD COLUMN unfaith_count INTEGER DEFAULT 0');
    console.log('✅ Added unfaith_count column to users table');
  } else {
    console.log('ℹ️  unfaith_count column already exists in users table');
  }
};

// 添加 free_reserve_count 字段到用户表（如果不存在）
export const addFreeReserveCountColumn = async () => {
  const database = await getDatabase();

  // 检查列是否已存在
  const checkStmt = database.prepare('PRAGMA table_info(users)');
  const result = [] as any[];
  while (checkStmt.step()) {
    const row = checkStmt.getAsObject() as any;
    result.push(row);
  }
  const hasFreeReserveCount = result.some((col: any) => col.name === 'free_reserve_count');

  if (!hasFreeReserveCount) {
    database.run('ALTER TABLE users ADD COLUMN free_reserve_count INTEGER DEFAULT 0');
    console.log('✅ Added free_reserve_count column to users table');
  } else {
    console.log('ℹ️  free_reserve_count column already exists in users table');
  }
};

// 移除预约表的唯一约束（允许取消后重新预约同一时间段）
export const removeReservationUniqueConstraint = async () => {
  const database = await getDatabase();

  // 检查约束是否存在
  const checkStmt = database.prepare('PRAGMA table_info(reservations)');
  const result = [] as any[];
  while (checkStmt.step()) {
    result.push(checkStmt.getAsObject());
  }

  // 获取现有数据
  const backupStmt = database.prepare('SELECT * FROM reservations');
  const backup: any[] = [];
  while (backupStmt.step()) {
    backup.push(backupStmt.getAsObject());
  }

  // 删除旧表
  database.run('DROP TABLE IF EXISTS reservations');

  // 重新创建表（不带 UNIQUE 约束）
  const sql = `
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      gym_id INTEGER NOT NULL,
      time_slot_id INTEGER NOT NULL,
      reservation_date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (gym_id) REFERENCES gyms(id),
      FOREIGN KEY (time_slot_id) REFERENCES time_slots(id)
    )
  `;
  database.run(sql);

  // 恢复数据
  if (backup.length > 0) {
    const insertStmt = database.prepare(`
      INSERT INTO reservations (id, user_id, gym_id, time_slot_id, reservation_date, created_at)
      VALUES (:id, :user_id, :gymId, :timeSlotId, :date, :createdAt)
    `);
    backup.forEach(row => {
      insertStmt.run({
        ':id': row.id,
        ':user_id': row.user_id,
        ':gymId': row.gym_id,
        ':timeSlotId': row.time_slot_id,
        ':date': row.reservation_date,
        ':createdAt': row.created_at
      });
    });
  }

  console.log('✅ Removed UNIQUE constraint from reservations table');
};

// 初始化数据库
export const initDatabase = async () => {
  try {
    await createUsersTable();
    await addUnfaithCountColumn(); // 添加 unfaith_count 字段
    await addFreeReserveCountColumn(); // 添加 free_reserve_count 字段
    await createGymsTable();
    await createTimeSlotsTable();
    await createReservationsTable();
    await removeReservationUniqueConstraint(); // 移除预约表的唯一约束
    await createAnnouncementsTable();
    await createSystemSettingsTable(); // 创建系统设置表
    await createReservationLimitsTable();
    await createQrCodesTable(); // 创建二维码表
    await initMainAdmin();
    await initDefaultGyms();
    await initDefaultSystemSettings(); // 初始化默认系统设置
    saveDatabase();
    console.log('🎉 Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

// 导出 db 为 Promise，这样其他模块可以 await 它
export const dbPromise = getDatabase();

// 默认导出（同步使用时需要 await）
export default dbPromise;

// 创建公告表
export const createAnnouncementsTable = async () => {
  const database = await getDatabase();
  const sql = `
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title VARCHAR(100) NOT NULL,
      description TEXT,
      content TEXT,
      image_url VARCHAR(500) NOT NULL,
      link_url VARCHAR(500),
      order_index INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  database.run(sql);
  console.log('✅ Announcements table created');

  // 添加 content 字段（如果不存在）
  try {
    database.run('ALTER TABLE announcements ADD COLUMN content TEXT');
    console.log('ℹ️  content column added to announcements table');
  } catch (e) {
    // 字段已存在，忽略错误
  }
};

// 创建系统设置表
export const createSystemSettingsTable = async () => {
  const database = await getDatabase();
  const sql = `
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key VARCHAR(50) NOT NULL UNIQUE,
      setting_value VARCHAR(200) NOT NULL,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  database.run(sql);
  console.log('✅ System settings table created');
};

// 初始化默认系统设置
export const initDefaultSystemSettings = async () => {
  const database = await getDatabase();
  const stmt = database.prepare('SELECT COUNT(*) as count FROM system_settings');
  const result = stmt.getAsObject({}) as { count: number };

  if (result.count === 0) {
    const insertStmt = database.prepare(`
      INSERT INTO system_settings (setting_key, setting_value, description)
      VALUES (:key, :value, :description)
    `);
    // 默认预约开放时间：20:00
    insertStmt.run({
      ':key': 'booking_open_time',
      ':value': '20:00',
      ':description': '每天开放预约第二天的时间点（格式：HH:mm）'
    });
    console.log('✅ Default system settings created');
  } else {
    console.log('ℹ️  System settings already exist');
  }
};

// 当直接运行此文件时，初始化数据库
// initDatabase() is now called explicitly in index.ts before starting the server
// initDatabase().catch(console.error);
