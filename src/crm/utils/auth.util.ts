import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { UserModel } from '../models/user.model';
import EnvConfig from '../../configs/env.config';
import logger from '../../configs/logger.config';

export class AuthService {
  static async register(username: string, password: string, role: 'admin' | 'user' = 'user') {
    const existingUser = await UserModel.findOne({ username });
    if (existingUser) {
      throw new Error('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new UserModel({ username, password: hashedPassword, role });
    await user.save();

    return user;
  }

  static async login(username: string, password: string) {
    try {
      logger.info(`Attempting login for username: ${username}`);
      const user = await UserModel.findOne({ username }).lean();
      
      if (!user) {
        logger.warn(`User not found: ${username}`);
        // Intentar buscar en la colección 'users' directamente si existe
        const db = mongoose.connection.db;
        if (db) {
          const usersCollection = db.collection('users');
          const dbUser = await usersCollection.findOne({ username });
          if (dbUser) {
            logger.info(`Found user in 'users' collection, but model lookup failed`);
          }
        }
        throw new Error('Invalid credentials');
      }

      logger.info(`User found: ${user.username}, comparing password...`);
      const isMatch = await bcrypt.compare(password, user.password);
      
      if (!isMatch) {
        logger.warn(`Password mismatch for user: ${username}`);
        throw new Error('Invalid credentials');
      }

      const token = jwt.sign(
        { userId: user._id, role: user.role },
        EnvConfig.JWT_SECRET,
        { expiresIn: '1d' }
      );

      logger.info(`Login successful for user: ${username}`);
      return { token, user };
    } catch (error: any) {
      logger.error(`Login error for ${username}:`, error);
      throw error;
    }
  }

  static async verifyToken(token: string) {
    try {
      return jwt.verify(token, EnvConfig.JWT_SECRET);
    } catch (error) {
      logger.error('Token verification failed:', error);
      return null;
    }
  }
}