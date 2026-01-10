module.exports = {
  apps: [
    {
      name: 'filmber',
      script: 'npx',
      args: 'tsx server/index.ts',
      cwd: '/var/www/filmber/current',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: '/var/www/filmber/logs/error.log',
      out_file: '/var/www/filmber/logs/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
