import * as winston from 'winston';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export class Logger {
  private logger: winston.Logger;
  private context: string;

  constructor(context: string) {
    this.context = context;
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const logDir = join(process.cwd(), 'logs');
    
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, context, stack }) => {
        const ctx = context || this.context;
        const baseMessage = `[${timestamp}] [${level.toUpperCase()}] [${ctx}] ${message}`;
        return stack ? `${baseMessage}\n${stack}` : baseMessage;
      })
    );

    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            logFormat
          )
        }),
        new winston.transports.File({
          filename: join(logDir, 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: join(logDir, 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        })
      ],
      exceptionHandlers: [
        new winston.transports.File({
          filename: join(logDir, 'exceptions.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        })
      ],
      rejectionHandlers: [
        new winston.transports.File({
          filename: join(logDir, 'rejections.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        })
      ]
    });
  }

  info(message: string, metadata?: any): void {
    this.logger.info(message, { context: this.context, ...metadata });
  }

  warn(message: string, metadata?: any): void {
    this.logger.warn(message, { context: this.context, ...metadata });
  }

  error(message: string, error?: Error | any, metadata?: any): void {
    if (error instanceof Error) {
      this.logger.error(message, { 
        context: this.context, 
        stack: error.stack, 
        ...metadata 
      });
    } else {
      this.logger.error(message, { 
        context: this.context, 
        error: error, 
        ...metadata 
      });
    }
  }

  debug(message: string, metadata?: any): void {
    this.logger.debug(message, { context: this.context, ...metadata });
  }

  verbose(message: string, metadata?: any): void {
    this.logger.verbose(message, { context: this.context, ...metadata });
  }

  setLevel(level: string): void {
    this.logger.level = level;
  }

  getLevel(): string {
    return this.logger.level;
  }

  child(childContext: string): Logger {
    return new Logger(`${this.context}:${childContext}`);
  }
}

export class GlobalLogger {
  private static instance: Logger;

  static getInstance(): Logger {
    if (!GlobalLogger.instance) {
      GlobalLogger.instance = new Logger('Global');
    }
    return GlobalLogger.instance;
  }

  static setLevel(level: string): void {
    GlobalLogger.getInstance().setLevel(level);
  }

  static info(message: string, metadata?: any): void {
    GlobalLogger.getInstance().info(message, metadata);
  }

  static warn(message: string, metadata?: any): void {
    GlobalLogger.getInstance().warn(message, metadata);
  }

  static error(message: string, error?: Error | any, metadata?: any): void {
    GlobalLogger.getInstance().error(message, error, metadata);
  }

  static debug(message: string, metadata?: any): void {
    GlobalLogger.getInstance().debug(message, metadata);
  }
}