import fs from 'fs';

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];

export default class SimpleFileLogger {
    #filePath;
    #level;

    constructor(filePath, levelString = 'info') {
        this.#filePath = filePath;
        const lcLevelString = levelString.toLowerCase();
        const level = LOG_LEVELS.indexOf(lcLevelString);
        this.#level = level === -1 ? 1 : level;
    }

    clear() {
        fs.rmSync(this.#filePath, { force: true });
    }

    debug(...data) {
        if (this.#level <= 0) this.log('DEBUG', data);
    }

    info(...data) {
        if (this.#level <= 1) this.log('INFO', data);
    }

    warn(...data) {
        if (this.#level <= 2) this.log('WARN', data);
    }

    error(...data) {
        if (this.#level <= 3) this.log('ERROR', data);
    }

    log(level, data) {
        const ts = new Date().toISOString();
        fs.appendFileSync(
            this.#filePath,
            `${ts}\t${level}\t${data.join('')}\n`
        );
    }
}
