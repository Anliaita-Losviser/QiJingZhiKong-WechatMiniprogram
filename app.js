// app.js
App({
  onLaunch() {
    // 本地存储能力
    wx.loadFontFace({
        family: 'Bitstream Vera Serif Bold',
        source: 'url("https://res.wx.qq.com/t/wx_fed/base/weixin_portal/res/static/font/33uDySX.ttf")',
        success: () => {
          console.log('字体加载成功');
        },
        fail: (err) => {
          console.error('字体加载失败', err);
        }
      });
  },
  globalData: {
    userInfo: null,
  },
  onHide(){
  },
});
