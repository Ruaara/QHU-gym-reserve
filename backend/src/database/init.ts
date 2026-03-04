import initSqlJs, { Database } from 'sql.js';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'database.db');

let db: Database | null = null;

// 加载或创建数据库
export const getDatabase = async (): Promise<Database> => {
  if (db) return db;

  const SQL = await initSqlJs();

  // 尝试加载现有数据库
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    // 创建新数据库
    db = new SQL.Database();
    saveDatabase();
  }

  // 启用外键约束
  db.run('PRAGMA foreign_keys = ON');

  return db;
};

// 保存数据库到文件
export const saveDatabase = () => {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
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
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  database.run(sql);
  console.log('✅ Gyms table created');
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
      FOREIGN KEY (gym_id) REFERENCES gyms(id)
    )
  `;
  database.run(sql);
  console.log('✅ Time slots table created');
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
      INSERT INTO users (name, account, password, role)
      VALUES (:name, :account, :password, :role)
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

// 创建取消预约记录表
export const createCancelledReservationsTable = async () => {
  const database = await getDatabase();
  const sql = `
    CREATE TABLE IF NOT EXISTS cancelled_reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      time_slot_id INTEGER NOT NULL,
      reservation_date DATE NOT NULL,
      cancelled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (time_slot_id) REFERENCES time_slots(id),
      UNIQUE(user_id, time_slot_id, reservation_date)
    )
  `;
  database.run(sql);
  console.log('✅ Cancelled reservations table created');
};

// 初始化数据库
export const initDatabase = async () => {
  try {
    await createUsersTable();
    await createGymsTable();
    await createTimeSlotsTable();
    await createReservationsTable();
    await createAnnouncementsTable();
    await createReservationLimitsTable();
    await createCancelledReservationsTable();
    await initMainAdmin();
    await initDefaultGyms();
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
      image_url VARCHAR(500) NOT NULL,
      link_url VARCHAR(500),
      order_index INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  database.run(sql);
  console.log('✅ Announcements table created');
};

