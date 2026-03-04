import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'database.db');

async function migrate() {
  console.log('开始迁移数据库...');

  // 加载数据库
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);

  // 启用外键约束
  db.run('PRAGMA foreign_keys = ON');

  // 检查表是否已存在
  const checkTable = (tableName: string): boolean => {
    const stmt = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name=:name
    `);
    const result = stmt.getAsObject({ ':name': tableName }) as any;
    return !!(result && result.name);
  };

  // 创建预约限制表
  if (!checkTable('reservation_limits')) {
    console.log('创建 reservation_limits 表...');
    db.run(`
      CREATE TABLE reservation_limits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        today_reserved BOOLEAN DEFAULT 0,
        today_change INTEGER DEFAULT 1,
        last_reset_date DATE NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('✅ reservation_limits 表创建成功');
  } else {
    console.log('ℹ️  reservation_limits 表已存在');
  }

  // 创建取消预约记录表
  if (!checkTable('cancelled_reservations')) {
    console.log('创建 cancelled_reservations 表...');
    db.run(`
      CREATE TABLE cancelled_reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        time_slot_id INTEGER NOT NULL,
        reservation_date DATE NOT NULL,
        cancelled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (time_slot_id) REFERENCES time_slots(id),
        UNIQUE(user_id, time_slot_id, reservation_date)
      )
    `);
    console.log('✅ cancelled_reservations 表创建成功');
  } else {
    console.log('ℹ️  cancelled_reservations 表已存在');
  }

  // 保存数据库
  const data = db.export();
  const bufferOut = Buffer.from(data);
  fs.writeFileSync(DB_PATH, bufferOut);

  console.log('🎉 数据库迁移完成！');
}

migrate().catch(console.error);
