module.exports = {
  apps: [
    {
      name: 'filmber',
      script: 'npx',
      args: 'tsx server/index.ts',
      cwd: '/var/www/filmber/current',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
  ],
};
