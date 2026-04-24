const { runTrafficTracker } = require('./src/jobs/trafficTracker');

async function testJob() {
  console.log('--- Manual Job Run ---');
  await runTrafficTracker();
  console.log('--- End Manual Job Run ---');
  process.exit(0);
}
testJob();
