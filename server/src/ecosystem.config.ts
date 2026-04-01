module.exports = {
    apps: [
      {
        name: '695dfb4c2b66e34074065ab3-server',
        script: 'npm',
        args: 'run dev',
        cwd: './server',
        instances: 1,
        exec_mode: 'fork',
        autorestart: true,
        watch: true,
        time: true
      },
      {
        name: '695dfb4c2b66e34074065ab3-client',
        script: 'npm',
        args: 'start',
        cwd: './client',
        instances: 1,
        exec_mode: 'fork',
        autorestart: true,
        watch: false,
        time: true
      }
    ]
  };