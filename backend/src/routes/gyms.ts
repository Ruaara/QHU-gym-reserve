import express from 'express';
import { getGyms } from '../controllers/gymController';

const router = express.Router();

// 获取健身房列表
router.get('/', getGyms);

export default router;
