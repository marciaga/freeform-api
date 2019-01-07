import Glue from 'glue';
import dotenv from 'dotenv';
import buildManifest from './manifest';

dotenv.config(); // load env vars

const options = { relativeTo: __dirname };

const { SENTRY_PUBLIC_KEY, SENTRY_SECRET_KEY, SENTRY_PROJECT_ID } = process.env;
const manifest = buildManifest({
  SENTRY_PUBLIC_KEY,
  SENTRY_SECRET_KEY,
  SENTRY_PROJECT_ID,
});

const startServer = async () => {
  try {
    const server = await Glue.compose(manifest, options);
    await server.start();
    console.log('Server running at: ', server.info.uri);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

startServer();
