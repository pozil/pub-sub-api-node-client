let isReporterInjected = false;

export default function injectJasmineReporter(logger) {
    // Only inject report once
    if (isReporterInjected) {
        return;
    }
    isReporterInjected = true;

    // Build and inject reporter
    const customReporter = {
        specStarted: (result) => {
            logger.info('----------');
            logger.info(`START TEST: ${result.description}`);
            logger.info('----------');
        },
        specDone: (result) => {
            logger.info('--------');
            logger.info(`END TEST: [${result.status}] ${result.description}`);
            logger.info('--------');
        }
    };
    const env = jasmine.getEnv();
    env.addReporter(customReporter);
}
