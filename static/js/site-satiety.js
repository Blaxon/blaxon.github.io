// 粉馆饱腹值的全站衰减器：不管访客在网站哪个页面，只要还在本站逛，
// 饱腹值就按真实经过的时间衰减；一旦离开本站（关标签页/去了别的网站）
// 超过 BROWSING_GRACE_MS，再回来时这段离开的时间不倒扣。
//
// 具体做法：每次任意页面加载/心跳时，比较当前时间和 localStorage 里记的
// lastActiveAt（"上一次确认还在本站"的时间戳）。间隔在阈值内 -> 按经过的
// 时长补扣；间隔超过阈值 -> 视为离开过，不补扣，只把 lastActiveAt 重置成现在。
//
// 状态结构和 storage key 必须跟 fenguan.js 保持一致，两边共用同一份
// localStorage 数据。
(function () {
  var STORAGE_KEY = "fenguan_state_v1";
  var STATE_VERSION = 2;
  var DECAY_INTERVAL_MS = 10000;
  var DECAY_AMOUNT = 1;
  var BROWSING_GRACE_MS = 60000;
  var HEARTBEAT_MS = 5000;

  function defaultState() {
    return {
      version: STATE_VERSION,
      visits: 0,
      satiety: 100,
      mood: 60,
      bowl: null,
      ordersCount: 0,
      slurpCount: 0,
      log: [],
      lastVisit: null,
      lastActiveAt: null,
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== STATE_VERSION) return defaultState();
      var base = defaultState();
      for (var key in base) {
        if (parsed[key] === undefined) parsed[key] = base[key];
      }
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function tick() {
    var state = loadState();
    var now = Date.now();

    if (state.lastActiveAt) {
      var gap = now - state.lastActiveAt;
      if (gap > 0 && gap <= BROWSING_GRACE_MS) {
        var ticks = Math.floor(gap / DECAY_INTERVAL_MS);
        if (ticks > 0) {
          state.satiety = clamp(state.satiety - ticks * DECAY_AMOUNT, 0, 100);
        }
      }
    }

    state.lastActiveAt = now;
    saveState(state);
  }

  tick();
  setInterval(tick, HEARTBEAT_MS);
})();
