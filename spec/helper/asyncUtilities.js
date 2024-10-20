export async function sleep(duration) {
    return new Promise((resolve) => setTimeout(() => resolve(), duration));
}

export async function waitFor(timeoutDuration, checkFunction) {
    return new Promise((resolve, reject) => {
        let checkInterval;
        const waitTimeout = setTimeout(() => {
            clearInterval(checkInterval);
            reject(`waitFor timed out after ${timeoutDuration} ms`);
        }, timeoutDuration);
        checkInterval = setInterval(() => {
            if (checkFunction()) {
                clearTimeout(waitTimeout);
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);
    });
}
