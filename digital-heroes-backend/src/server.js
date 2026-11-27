const env = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');
const { Order } = require('./models');

const dns = require("node:dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

(async () => {
  await connectDB();
  // If the server died mid print-job, mark those jobs failed so admins can simply re-run them.
  await Order.updateMany({ 'printJob.status': { $in: ['queued', 'running'] } }, { 'printJob.status': 'failed', 'printJob.error': 'Server restarted during job - regenerate files' });
  const server = app.listen(env.port, () => console.log(`[server] http://localhost:${env.port}  (${env.nodeEnv})`));
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
})().catch((e) => { console.error('Failed to start:', e); process.exit(1); });
