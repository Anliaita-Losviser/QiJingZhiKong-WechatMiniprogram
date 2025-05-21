// index.js
const defaultAvatarUrl =
  "写你自己的";
const KEY = "写你自己的";
const app = getApp();
import { get, post, baseURL, roomNumber } from "../../utils/request";
import { formatTime } from "../../utils/util";
import * as echarts from "../../ec-canvas/echarts";

function initChart(canvas, width, height) {
  // 使用新 API 获取设备信息
  const windowInfo = wx.getWindowInfo();
  const chart = echarts.init(canvas, null, {
    width: width,
    height: height,
    devicePixelRatio: windowInfo.pixelRatio, // 替换弃用方法
  });
  canvas.setChart(chart);
  // 使用静态初始配置，避免依赖 this.data
  const option = {
    xAxis: {
      type: "category",
      data: [], // 初始为空数组
      axisLabel: { rotate: 45 },
    },
    yAxis: [
      { type: "value", min: 0, max: 100, name: "温度(℃)" },
      { type: "value", min: 0, max: 100, name: "湿度(%)" },
    ],
    series: [
      {
        name: "温度",
        type: "line",
        data: [],
        smooth: true,
        itemStyle: { color: "#FF6B6B" },
        label: {
          show: true, // 开启标签显示
          position: "top", // 标签位置（可选值：top/bottom/left/right）
          color: "#FF6B6B", // 标签颜色
          formatter: "{c}℃", // 格式化显示数值（{c} 代表数据值）
        },
      },
      {
        name: "湿度",
        type: "line",
        data: [],
        smooth: true,
        itemStyle: { color: "#4ECDC4" },
        label: {
          show: true, // 开启标签显示
          position: "top", // 标签位置（可选值：top/bottom/left/right）
          color: "#4ECDC4", // 标签颜色
          formatter: "{c}%", // 格式化显示数值（{c} 代表数据值）
        },
      },
    ],
    // 图例配置
    legend: {
      data: ["温度", "湿度"],
    },
    // 网格配置（调整图表边距）
    grid: {
      top: "20%",
      bottom: "40%",
    },
  };
  chart.setOption(option);
  return chart;
}
Page({
  chartInstance: null,
  data: {
    title: '"栖境智控"-基于MQTT的智能旅店系统',
    welcome: "欢迎来到旅馆，今天的天气情况是晴天",
    locationa: "广州市 天河区",
    temperature: "无",
    roomNumber: wx.getStorageSync("roomNumber") || "",
    isConnect: false,
    max: "",
    min: "",
    clickIndex: 0, //点击的传感器设备下标
    measure_temperature: 0,
    thresholdDialog: false,
    mqttConnectDialog: false, //mqtt连接打开弹窗
    updateTimer: null, // 存储定时器ID
    isUpdating: false, // 更新状态标识

    // 设备信息
    sensorList: [
      //传感器列表
      //图 名字 参数 值 单位 序号
      {
        img: "/images/气温计.png",
        name: "DHT22",
        parameter: "温度",
        value: 0,
        unit: "°C",
        idx: 0,
        suggest1: "建议不高于26℃",
        suggest2: "建议不低于18℃",
      },
      {
        img: "/images/湿度.png",
        name: "DHT22",
        parameter: "湿度",
        value: 0,
        unit: "%rh",
        // isPass: true,
        idx: 1,
        suggest1: "建议不高于60％",
        suggest2: "建议不低于40％",
      },
    ],
    otherSensorList: [
      {
        img: "/images/灯.png",
        name: "灯",
        isOpen: false,
        commandKey: "light",
        roomNumber: "101",
      },
      {
        img: "/images/风扇.png",
        name: "风扇",
        isOpen: false,
        commandKey: "aircon",
        roomNumber: "101",
      },
      {
        img: "/images/门锁.png",
        name: "门锁",
        isOpen: false,
        commandKey: "lock",
        roomNumber: "101",
      },
    ],
    /**
     * // 温湿度数据
     */
    chartData: {
      temperature: {
        data: [], // 温度数据队列 [{time: 'HH:MM:SS', value: 25}, ...]
      },
      humidity: {
        data: [], // 湿度数据队列
      },
      time: {
        data: [], // 时间轴数据
      },
    },
    ec: {
      // 使用箭头函数绑定正确的this
      onInit: (canvas, width, height) => {
        this.chartInstance = initChart(canvas, width, height);
        return chart;
      },
    },
  },

  // 打开连接弹窗
  openDialog() {
    this.setData({ mqttConnectDialog: true });
  },
  onClose() {
    this.setData({ mqttConnectDialog: false });
  },
  closeConnect() {
    //若已有定时器，则先清除
    if (this.data.updateTimer) {
      clearInterval(this.data.updateTimer);
    }
    // 重置所有相关状态
    this.setData({
      updateTimer: null, // 清除定时器引用
      isUpdating: false, // 更新自动更新状态
      isConnect: false, // 连接状态
      measure_temperature: "--",
      "sensorList[0].value": "--",
      "sensorList[1].value": "--",
      roomNumber: "",
    });
  },
  openConnect() {
    if (this.data.isConnected) {
      // 已连接状态点击时断开
      this.stopRefresh();
    } else {
      // 未连接状态点击时连接
      this.startRefresh();
    }
  },
  // startRefresh 方法
  startRefresh() {
    //this.fetchData(); // 立即获取一次数据
    // 启动定时器
    const timer = setInterval(() => {
      this.fetchData();
    }, 2000);
    this.setData({
      isConnected: true,
      refreshTimer: timer,
    });
  },
  // 停止刷新
  stopRefresh() {
    if (this.data.refreshTimer) {
      clearInterval(this.data.refreshTimer);
    }
    this.setData({
      isConnected: false,
      refreshTimer: null,
    });
  },
  /**
   * 数据请求
   */
  fetchData(showAlert = false) {
    // 新增参数控制提示
    const that = this;
    const options = {
      roomNumber: this.data.roomNumber,
    };
    get(baseURL + "/mqtt/revmsg/" + options.roomNumber)
      .then((res) => {
        console.log("主页面数据获取成功:", res);
        that.setData({
          measure_temperature: res.Temperature,
          "sensorList[0].value": res.data.Temperature,
          "sensorList[1].value": res.data.Humidity,
          isConnect: true,
        });
        //创建映射关系
        const paramMap = {
          温度: "Temperature",
          湿度: "Humidity",
        };
        // 更新 sensorList
        const updatedList = this.data.sensorList.map((item) => {
          const apiKey = paramMap[item.parameter]; // 获取接口对应字段名
          return {
            ...item,
            value: res.data[apiKey] || "--", // 更新数值（兼容异常值）
          };
        });
        this.setData({ sensorList: updatedList });
        // 确保返回数据包含温度湿度字段
        const newData = {
          temperature: res.data.Temperature || 0,
          humidity: res.data.Humidity || 0,
          time: formatTime(new Date()),
        };
        console.log("收到数据:", {
          temp: newData.temperature,
          humi: newData.humidity,
          time: newData.time,
        });
        // 触发图表更新
        this.updateChartData(newData);
        // 连接成功提示（仅在首次请求时显示）
        if (showAlert) {
          wx.showToast({
            title: "连接成功",
            icon: "success",
            duration: 2000,
          });
        }
      })
      .catch((err) => {
        console.log("请求失败:", err);
        this.stopRefresh();
        // 连接失败提示（仅在首次请求时显示）
        if (showAlert) {
          wx.showToast({
            title: "连接失败，请检查网络",
            icon: "none",
            duration: 2000,
          });
        }
      });
  },
  // 修改 updateChartData 方法
  updateChartData(newData) {
    if (!this.chartInstance) {
      console.error("图表实例未初始化");
      return;
    }
    // 更新数据队列（最多保留5个点）
    const trimData = (arr) => (arr.length > 5 ? arr.slice(-5) : arr);
    const tempData = trimData([
      ...this.data.chartData.temperature.data,
      { value: newData.temperature, time: newData.time },
    ]);
    const humiData = trimData([
      ...this.data.chartData.humidity.data,
      { value: newData.humidity, time: newData.time },
    ]);
    // 生成时间轴
    const timeData = trimData([
      ...this.data.chartData.time.data,
      { value: newData.time, time: newData.time },
    ]);
    // 更新图表
    this.chartInstance.setOption({
      xAxis: { data: timeData },
      series: [
        { data: tempData.map((d) => d.value) },
        { data: humiData.map((d) => d.value) },
      ],
    });
    // 同步页面数据
    this.setData({
      "chartData.temperature.data": tempData,
      "chartData.humidity.data": humiData,
      "chartData.time.data": timeData,
    });
  },
  /**
   * 页面生命周期函数
   */
  onLoad() {
    this.getUserLocation();
    this.updateChartData({
      temperature: 25,
      humidity: 60,
      time: new Date().toLocaleTimeString(),
    });
  },
  onUnload() {
    this.stopRefresh();
  },
  onReady() {
    // 强制初始化图表组件
    this.setData({
      ec: {
        onInit: (canvas, width, height) => {
          const chart = initChart(canvas, width, height);
          this.chartInstance = chart;
          return chart;
        },
      },
    });
  },

  SystemChange(e) {
    const index = e.currentTarget.dataset.index; // 获取设备索引
    const checked = e.detail.value; // 获取开关状态
    const device = this.data.otherSensorList[index]; // 立即更新界面状态

    this.setData({
      [`otherSensorList[${index}].isOpen`]: checked,
    }); // 构建请求参数

    const postData = {
      roomNumber: device.roomNumber, //subTopic: device.subTopic,
      command: {
        [device.commandKey]: checked ? "open" : "close",
      },
    }; // 发送控制指令
    post(baseURL + "/mqtt/pubcommand", postData)
      .then((res) => {
        console.log("发布指令成功", res);
      })
      .catch((err) => {
        console.log("发布指令失败", err);
      });
  }, // 显示错误提示并回滚状态
  showErrorToast(msg, index, correctState) {
    wx.showToast({
      title: msg,
      icon: "none",
      duration: 2000,
    });
    this.setData({
      [`otherSensorList[${index}].isOpen`]: correctState,
    });
  },

  getUserLocation() {
    let that = this;
    wx.getSetting({
      success: (res) => {
        console.log(res, JSON.stringify(res));
        if (
          res.authSetting["scope.userLocation"] != undefined &&
          res.authSetting["scope.userLocation"] != true
        ) {
          wx.showModal({
            title: "请求授权当前位置",
            content: "需要获取您的地理位置，请确认授权",
            success: function (res) {
              if (res.cancel) {
                wx.showToast({
                  title: "拒绝授权",
                  icon: "none",
                  duration: 1000,
                });
              } else if (res.confirm) {
                wx.openSetting({
                  success: function (dataAu) {
                    if (dataAu.authSetting["scope.userLocation"] == true) {
                      wx.showToast({
                        title: "授权成功",
                        icon: "success",
                        duration: 1000,
                      });
                      //再次授权，调用wx.getLocation的API
                      that.getLocation();
                    } else {
                      wx.showToast({
                        title: "授权失败",
                        icon: "none",
                        duration: 1000,
                      });
                    }
                  },
                });
              }
            },
          });
        } else if (res.authSetting["scope.userLocation"] == undefined) {
          that.getLocation();
        } else {
          that.getLocation();
        }
      },
    });
  },
  getLocation() {
    let that = this;
    wx.getLocation({
      type: "wgs84",
      success(res) {
        console.log("经纬度", res);
        if (res?.errMsg === "getLocation:ok") {
          /* ----------------通过经纬度获取地区编码---------------- */
          wx.request({
            url: "https://restapi.amap.com/v3/geocode/regeo?parameters",
            data: {
              key: KEY, //填入自己申请到的Key
              location: res.longitude + "," + res.latitude, //传入经纬度
            },
            header: {
              "content-type": "application/json",
            },
            success: function (res) {
              console.log("坐标转换和查询天气", res.data);
              wx.setStorageSync(
                "city",
                res.data.regeocode.addressComponent.adcode //地区编码
              );
              that.setData({
                location:
                  res.data.regeocode.addressComponent.city +
                  " " +
                  res.data.regeocode.addressComponent.district,
              });
              wx.request({
                url: "https://restapi.amap.com/v3/weather/weatherInfo",
                data: {
                  key: KEY, //填入自己申请到的Key
                  city: res.data.regeocode.addressComponent.adcode, //传入地区编码
                },
                header: {
                  "content-type": "application/json",
                },
                success: function (weather) {
                  console.log("天气", weather.data);
                  that.setData({
                    weatherNum: weather.data.lives[0].temperature, //温度
                    weatherText: weather.data.lives[0].weather, //天气描述 晴天 下雨天...
                    temperature: weather.data.lives[0].temperature,
                    welcome:
                      "欢迎来到旅馆！今天的天气是 " +
                      weather.data.lives[0].weather, //欢迎语
                  });
                },
              });
            },
          });
        }
      },
      fail(err) {
        console.log(
          "获取经纬度错误信息,看到此提示信息请去文档网站右上角常见问题寻找答案",
          err
        );
      },
    });
  },
  //   点击设置阈值
  setThresholdValue(e) {
    let data = e.currentTarget.dataset.param;
    let index = data.idx;
    console.log(data, index);
    this.setData({
      thresholdDialog: true,
      max: "",
      min: "",
      clickIndex: index,
    });
  },
  //   弹窗确定按钮
  thresholdClose() {
    let [index, max, min] = [
      this.data.clickIndex,
      Number(this.data.max),
      Number(this.data.min),
    ];
    console.log(index, max, min);
    this.setData({
      ["sensorList[" + index + "].max"]: max,
      ["sensorList[" + index + "].min"]: min,
    });
    console.log(this.data.sensorList);
  },
});
