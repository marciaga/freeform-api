const buildManifest = (vars) => {
  const { SENTRY_PUBLIC_KEY, SENTRY_SECRET_KEY, SENTRY_PROJECT_ID } = vars;
  const SENTRY_DSN = process.env.NODE_ENV !== 'development' ? `http://${SENTRY_PUBLIC_KEY}:${SENTRY_SECRET_KEY}@sentry.io/${SENTRY_PROJECT_ID}` : false;

  return {
    server: {
      port: 8000,
    },
    register: {
      plugins: [{
        plugin: 'good',
        options: {
          ops: false,
          reporters: {
            console: [{
              module: 'good-console',
            }, 'stdout'],
          },
        },
      }, {
        plugin: './modules/mongodb',
        options: {
          settings: {
            db: {
              native_parser: false,
              numberOfRetries: 30,
              retryMiliSeconds: 1000,
            },
          },
        },
      }, {
        plugin: './modules/auth',
      }, {
        plugin: './modules/api',
      }, {
        plugin: 'hapi-sentry',
        options: {
          client: {
            dsn: SENTRY_DSN,
          },
        },
      }],
    },
  };
};

export default buildManifest;
