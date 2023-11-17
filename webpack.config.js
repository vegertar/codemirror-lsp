module.exports = {
  devServer: {
    proxy: {
      "/ls/example/plaintext": {
        target: "ws://127.0.0.1:3000",
        ws: true,
      },
    },
  },
};
