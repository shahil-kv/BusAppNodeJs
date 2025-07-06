// Simple logger utility for controlling log output
export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3
}

class Logger {
    private level: LogLevel = LogLevel.INFO;

    setLevel(level: LogLevel) {
        this.level = level;
    }

    error(message: string, ...args: any[]) {
        if (this.level >= LogLevel.ERROR) {
            console.error(`❌ ${message}`, ...args);
        }
    }

    warn(message: string, ...args: any[]) {
        if (this.level >= LogLevel.WARN) {
            console.warn(`⚠️ ${message}`, ...args);
        }
    }

    info(message: string, ...args: any[]) {
        if (this.level >= LogLevel.INFO) {
            console.log(`ℹ️ ${message}`, ...args);
        }
    }

    debug(message: string, ...args: any[]) {
        if (this.level >= LogLevel.DEBUG) {
            console.log(`🔍 ${message}`, ...args);
        }
    }

    success(message: string, ...args: any[]) {
        if (this.level >= LogLevel.INFO) {
            console.log(`✅ ${message}`, ...args);
        }
    }

    // Simple log for important events only
    log(message: string, ...args: any[]) {
        console.log(message, ...args);
    }
}

export const logger = new Logger();

// Set log level based on environment - REDUCE VERBOSITY
if (process.env.NODE_ENV === 'production') {
    logger.setLevel(LogLevel.ERROR);
} else if (process.env.LOG_LEVEL === 'debug') {
    logger.setLevel(LogLevel.DEBUG);
} else {
    // Only show important logs in development
    logger.setLevel(LogLevel.WARN);
} 