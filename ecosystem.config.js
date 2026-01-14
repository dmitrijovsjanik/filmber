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
      // Prevent rapid restart loops
      restart_delay: 3000, // Wait 3s between restarts
      kill_timeout: 5000, // Wait 5s for graceful shutdown
      max_restarts: 10, // Max 10 restarts in min_uptime window
      min_uptime: 10000, // Consider crashed if dies within 10s
      exp_backoff_restart_delay: 1000, // Exponential backoff starting at 1s
    },
  ],
};
