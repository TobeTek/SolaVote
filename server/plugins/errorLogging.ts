// server/plugins/error-logger.ts

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, { event }) => {
    // Log the error for local debugging or send it to an external service (e.g., Sentry)
    console.error('SERVER ERROR CAUGHT BY HOOK:', error);

    // You can also inspect the event object for request details
    // console.log('Request URL:', event.node.req.url);

    // Note: Do not throw a new error from here, as it may cause a loop.
  });
});