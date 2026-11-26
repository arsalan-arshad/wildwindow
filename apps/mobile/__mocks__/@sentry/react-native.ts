export const init = jest.fn();
export const captureException = jest.fn();

const Sentry = { init, captureException };

export default Sentry;
