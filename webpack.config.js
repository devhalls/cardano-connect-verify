const path = require('path');

module.exports = {
    target: 'node',
    mode: 'production',
    entry: './api/index.js',
    output: {
        path: path.resolve(__dirname, 'build'),
        publicPath: '/',
        filename: 'app.js',
    },
    experiments: {
        asyncWebAssembly: true,
        syncWebAssembly: true,
    },
};
