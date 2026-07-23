module.exports = {
  apps: [{
    name: 'rpkm',
    script: 'server.js',
    node_args: '--env-file=.env',
    instances: 1,          // ровно 1 экземпляр
    exec_mode: 'fork',
    // PORT=3001 — VideoAI/VidFlex занимает 3000 на этом же сервере
    env: { NODE_ENV: 'production', PORT: '3001' }
  }]
};
