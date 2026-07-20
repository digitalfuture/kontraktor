module.exports = {
  apps: [
    {
      name: 'kontraktor-prod',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
        BASE_URL: 'https://kontraktor.app',
      },
      max_memory_restart: '256M',
      restart_delay: 4000,
      max_restarts: 10,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/var/log/kontraktor/prod_error.log',
      out_file: '/var/log/kontraktor/prod_out.log',
      pid_file: '/root/.pm2/pids/kontraktor-prod.pid',
    },
    {
      name: 'kontraktor-dev',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'development',
        PORT: 3003,
        BASE_URL: 'https://dev.kontraktor.app',
        NODE_OPTIONS: '--max-old-space-size=512',
      },
      max_memory_restart: '256M',
      restart_delay: 4000,
      max_restarts: 10,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/var/log/kontraktor/dev_error.log',
      out_file: '/var/log/kontraktor/dev_out.log',
      pid_file: '/root/.pm2/pids/kontraktor-dev.pid',
      autorestart: true,
    },
  ],
};
