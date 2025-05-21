// utils/http.js
export const baseURL = "http://8.134.185.199:28089/user"; // 统一API根路径[3,5](@ref)
export const roomNumber = "";
// utils/request.js
function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      success: (res) => {
        if (res.statusCode === 200) resolve(res.data);
        else reject(res);
      },
      fail: reject,
    });
  });
}

export const get = (url, params) =>
  request({ url, method: "GET", data: params });
export const post = (url, data) => request({ url, method: "POST", data });
