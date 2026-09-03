(function () {
  var STORAGE_KEY = "fenguan_state_v1";
  var STATE_VERSION = 2;
  var LOG_LIMIT = 20;
  var SLURP_COOLDOWN_MS = 1000;
  var ORDER_FILL_MS = 2000;
  var SATIETY_DECAY_INTERVAL_MS = 10000;
  var SATIETY_DECAY_AMOUNT = 1;
  var SATIETY_FULL_THRESHOLD = 95;
  var SATIETY_PER_SLURP = 10;
  var SLURPS_PER_BOWL = 3;

  // 天气驱动 subtitle：固定用某地坐标（不做浏览器定位，不弹权限、
  // 不暴露访客位置），走 Open-Meteo（免 key、支持 CORS，静态站能直接调）。
  var WEATHER_LAT = 29.03;
  var WEATHER_LON = 111.70;
  var WEATHER_API_URL =
    "https://api.open-meteo.com/v1/forecast?latitude=" + WEATHER_LAT +
    "&longitude=" + WEATHER_LON +
    "&current=temperature_2m,weather_code&timezone=Asia%2FShanghai";
  var WEATHER_CACHE_KEY = "fenguan_weather_v1";
  var WEATHER_CACHE_MS = 45 * 60 * 1000; // 45 分钟内不重复请求
  var WEATHER_FETCH_TIMEOUT_MS = 5000;

  function defaultState() {
    return {
      version: STATE_VERSION,
      visits: 0,
      satiety: 100,
      mood: 60,
      bowl: null, // { itemId, name, remaining } 手里还没嗦完的一碗粉
      ordersCount: 0,
      slurpCount: 0,
      log: [],
      lastVisit: null,
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

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function readMenu() {
    var el = document.querySelector("[data-fenguan-menu-data]");
    if (!el) return [];
    try {
      var data = JSON.parse(el.textContent || "{}");
      return data.items || [];
    } catch (e) {
      return [];
    }
  }

  // WMO 天气码分组，映射成粉馆巷子的氛围文案（占位基调，后续再迭代）。
  var WEATHER_TEXTS = {
    clear: [
      "夜里天很晴，巷口的灯笼把影子拉得老长。",
      "月亮挂得高高的，风都是清爽的。",
    ],
    cloudy: [
      "天阴沉沉的，巷子里雾蒙蒙的，正好衬着这碗粉的热气。",
      "云层压得有点低，倒显得巷子更安静了。",
    ],
    fog: [
      "雾气把巷子裹住了，灯笼是唯一亮着的光。",
      "雾大得很，隔壁桌说话都听着闷闷的。",
    ],
    drizzle: [
      "外头飘着毛毛雨，屋檐下滴滴答答的，粉馆里更暖了。",
      "细雨斜斜地下着，正是窝在这儿嗦粉的好天气。",
    ],
    rain: [
      "外头下着雨，屋檐滴答，粉馆里更暖了，聊两句正好。",
      "雨声哗哗的，没人急着走，都窝在桌边慢慢嗦。",
    ],
    snow: [
      "巷子里飘起了雪，难得一见，粉馆的灯显得格外暖。",
      "雪落无声，倒是这碗热粉的香气飘得更远了。",
    ],
    thunderstorm: [
      "外头打着雷，闪电照亮了巷口，没人愿意这时候出门。",
      "雷声滚滚，桌上的粉倒是吃得更香了。",
    ],
  };

  function weatherCodeToCategory(code) {
    if (code === 0) return "clear";
    if (code === 1 || code === 2 || code === 3) return "cloudy";
    if (code === 45 || code === 48) return "fog";
    if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57) return "drizzle";
    if (
      code === 61 || code === 63 || code === 65 ||
      code === 66 || code === 67 ||
      code === 80 || code === 81 || code === 82
    ) {
      return "rain";
    }
    if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) {
      return "snow";
    }
    if (code === 95 || code === 96 || code === 99) return "thunderstorm";
    return null;
  }

  function buildWeatherSubtitle(weather) {
    var category = weatherCodeToCategory(weather.code);
    if (!category || !WEATHER_TEXTS[category]) return null;
    var text = pickRandom(WEATHER_TEXTS[category]);
    if (typeof weather.temp === "number") {
      if (weather.temp <= 5) {
        text += "天冷，多喝两口热汤最实在。";
      } else if (weather.temp >= 32) {
        text += "天热，粉馆的风扇转得更卖力了。";
      }
    }
    return text;
  }

  function readWeatherCache() {
    try {
      var raw = localStorage.getItem(WEATHER_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.fetchedAt !== "number") return null;
      if (Date.now() - parsed.fetchedAt > WEATHER_CACHE_MS) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function saveWeatherCache(weather) {
    try {
      localStorage.setItem(
        WEATHER_CACHE_KEY,
        JSON.stringify({ code: weather.code, temp: weather.temp, fetchedAt: Date.now() })
      );
    } catch (e) {}
  }

  function applyWeatherSubtitle(text) {
    var el = document.querySelector("[data-fenguan-subtitle]");
    if (!el || !text) return;
    el.textContent = text;
    el.style.transition = "none";
    el.style.opacity = "0";
    // 强制 reflow，确保下面的 transition 能从 0 开始
    void el.offsetWidth;
    el.style.transition = "opacity 400ms linear";
    el.style.opacity = "1";
  }

  // 独立于点单/嗦粉状态机：请求失败、超时、隐私模式拦截都只是静默保留
  // content/fenguan.md 里写死的默认 subtitle，不影响页面其余功能。
  function initWeatherSubtitle() {
    var cached = readWeatherCache();
    if (cached) {
      applyWeatherSubtitle(buildWeatherSubtitle(cached));
      return;
    }

    if (typeof fetch !== "function") return;

    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timeoutId = setTimeout(function () {
      if (controller) controller.abort();
    }, WEATHER_FETCH_TIMEOUT_MS);

    fetch(WEATHER_API_URL, controller ? { signal: controller.signal } : undefined)
      .then(function (res) {
        if (!res.ok) throw new Error("weather request failed");
        return res.json();
      })
      .then(function (data) {
        clearTimeout(timeoutId);
        var current = data && data.current;
        if (!current || typeof current.weather_code !== "number") return;
        var weather = { code: current.weather_code, temp: current.temperature_2m };
        saveWeatherCache(weather);
        applyWeatherSubtitle(buildWeatherSubtitle(weather));
      })
      .catch(function () {
        clearTimeout(timeoutId);
        // 静默失败，保留默认 subtitle
      });
  }

  function init() {
    var root = document.querySelector("[data-fenguan-menu]");
    if (!root) return; // 不在粉馆页面

    var menu = readMenu();
    var state = loadState();

    state.visits += 1;
    state.lastVisit = new Date().toISOString();
    saveState(state);

    var els = {
      log: document.querySelector("[data-fenguan-log]"),
      hint: document.querySelector("[data-fenguan-hint]"),
      bowlStatus: document.querySelector("[data-fenguan-bowl-status]"),
      slurpBtn: document.querySelector("[data-fenguan-slurp]"),
      slurpFill: document.querySelector("[data-fenguan-slurp-progress]"),
      messageBtn: document.querySelector("[data-fenguan-message]"),
      orderBtns: document.querySelectorAll("[data-fenguan-order]"),
      stats: {
        satiety: document.querySelector('[data-fenguan-stat="satiety"]'),
        mood: document.querySelector('[data-fenguan-stat="mood"]'),
        visits: document.querySelector('[data-fenguan-stat="visits"]'),
      },
    };

    var ordering = false;

    // 统一的事件记录入口：v1 只写本地日志，未来要接跨访客共享数据，
    // 只需要在这里补一次上报，调用点（点单/嗦粉）不用改。
    function recordEvent(text) {
      state.log.unshift({ text: text, at: Date.now() });
      state.log = state.log.slice(0, LOG_LIMIT);
      saveState(state);
      appendLogEntry(text);
    }

    function renderStats() {
      if (els.stats.satiety) els.stats.satiety.style.width = state.satiety + "%";
      if (els.stats.mood) els.stats.mood.style.width = state.mood + "%";
      if (els.stats.visits) els.stats.visits.textContent = state.visits + " 次";

      if (els.bowlStatus) {
        if (state.bowl && state.bowl.remaining > 0) {
          els.bowlStatus.textContent =
            "手里还有一碗" + state.bowl.name + "，还能嗦 " + state.bowl.remaining + " 次。";
        } else {
          els.bowlStatus.textContent = "吃什么好呢，先点一碗吧。";
        }
      }

      if (els.slurpBtn) {
        var hasBowl = state.bowl && state.bowl.remaining > 0;
        els.slurpBtn.disabled = !hasBowl || els.slurpBtn.dataset.cooling === "true";
      }

      if (!ordering) {
        els.orderBtns.forEach(function (btn) {
          btn.disabled = false;
        });
      }
    }

    // 首次进页面时，把持久化的历史日志一次性铺好（不带入场动画，
    // 动画只用来强调"刚刚发生的新事件"）。旧日志的"淡出"效果完全
    // 交给 CSS 的 .fenguan-log-fade 渐变蒙版做，越接近底部越融进卡片背景。
    function renderLog() {
      if (!els.log) return;
      els.log.innerHTML = "";
      if (state.log.length === 0) {
        appendEmptyPlaceholder();
        return;
      }
      state.log.forEach(function (entry) {
        var li = document.createElement("li");
        li.textContent = entry.text;
        els.log.appendChild(li);
      });
    }

    function appendEmptyPlaceholder() {
      var li = document.createElement("li");
      li.className = "text-xs text-muted";
      li.setAttribute("data-fenguan-log-empty", "");
      li.textContent = "还没什么动静，先嗦一口暖暖场。";
      els.log.appendChild(li);
    }

    // 参考 A Dark Room 的 notifications.js：新日志插到最前面，
    // 用一个 opacity 0 -> 1 的短过渡"淡入"进场，而不是整份重画列表。
    function appendLogEntry(text) {
      if (!els.log) return;
      var placeholder = els.log.querySelector("[data-fenguan-log-empty]");
      if (placeholder) placeholder.remove();

      var li = document.createElement("li");
      li.textContent = text;
      li.style.opacity = "0";
      els.log.insertBefore(li, els.log.firstChild);

      // 强制 reflow，确保 transition 能从 0 开始
      void li.offsetWidth;
      li.style.transition = "opacity 500ms linear";
      li.style.opacity = "1";

      while (els.log.children.length > LOG_LIMIT) {
        els.log.removeChild(els.log.lastChild);
      }
    }

    function showHint(text) {
      if (!els.hint) return;
      els.hint.textContent = text;
    }

    function findMenuItem(id) {
      for (var i = 0; i < menu.length; i++) {
        if (menu[i].id === id) return menu[i];
      }
      return null;
    }

    function slurp() {
      if (!state.bowl || state.bowl.remaining <= 0) {
        showHint("碗已经空了，先点一碗新的粉吧。");
        return;
      }

      state.slurpCount += 1;
      state.bowl.remaining -= 1;
      state.satiety = clamp(state.satiety + SATIETY_PER_SLURP, 0, 100);
      state.mood = clamp(state.mood + 4, 0, 100);
      if (state.bowl.remaining <= 0) state.bowl = null;

      var texts = [
        "嗦了一口热汤，从喉咙一直暖到胃里。",
        "老板顺手多舀了一勺汤，说是不要钱。",
        "隔壁桌在讨论今天的球赛，你也跟着笑了两声。",
        "风扇吱呀吱呀转着，粉还是很烫，慢慢嗦。",
      ];
      recordEvent(pickRandom(texts));
      showHint("");
      renderStats();
      saveState(state);

      els.slurpBtn.dataset.cooling = "true";
      els.slurpBtn.disabled = true;

      if (els.slurpFill) {
        els.slurpFill.style.transition = "none";
        els.slurpFill.style.width = "0%";
        // 强制 reflow，确保下面的 transition 能从 0% 重新开始
        void els.slurpFill.offsetWidth;
        els.slurpFill.style.transition = "width " + SLURP_COOLDOWN_MS + "ms linear";
        els.slurpFill.style.width = "100%";
      }

      setTimeout(function () {
        els.slurpBtn.dataset.cooling = "false";
        renderStats();
        if (els.slurpFill) {
          els.slurpFill.style.transition = "none";
          els.slurpFill.style.width = "0%";
        }
      }, SLURP_COOLDOWN_MS);
    }

    function order(id) {
      if (ordering) return;
      var item = findMenuItem(id);
      if (!item) return;

      if (state.satiety >= SATIETY_FULL_THRESHOLD) {
        recordEvent("你还不饿，先逛逛再嗦粉吧。");
        return;
      }

      var btn = document.querySelector('[data-fenguan-order="' + id + '"]');
      var fill = btn && btn.querySelector("[data-fenguan-order-progress]");

      ordering = true;
      showHint("");
      els.orderBtns.forEach(function (b) {
        b.disabled = true;
      });

      if (fill) {
        fill.style.transition = "none";
        fill.style.width = "0%";
        // 强制 reflow，确保下面的 transition 能从 0% 重新开始
        void fill.offsetWidth;
        fill.style.transition = "width " + ORDER_FILL_MS + "ms linear";
        fill.style.width = "100%";
      }

      setTimeout(function () {
        ordering = false;
        state.ordersCount += 1;
        state.bowl = { itemId: item.id, name: item.name, remaining: SLURPS_PER_BOWL };
        if (typeof item.mood === "number") {
          state.mood = clamp(state.mood + item.mood, 0, 100);
        }

        var texts =
          item.flavorTexts && item.flavorTexts.length
            ? item.flavorTexts
            : ["一碗" + item.name + "端上来了。"];
        recordEvent("点了一碗" + item.name + "：" + pickRandom(texts));
        saveState(state);
        renderStats();

        if (fill) {
          fill.style.transition = "none";
          fill.style.width = "0%";
        }
      }, ORDER_FILL_MS);
    }

    if (els.slurpBtn) {
      els.slurpBtn.addEventListener("click", slurp);
    }

    els.orderBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        order(btn.getAttribute("data-fenguan-order"));
      });
    });

    if (els.messageBtn) {
      els.messageBtn.addEventListener("click", function () {
        showHint("留言板还在装修，敬请期待。");
      });
    }

    setInterval(function () {
      state.satiety = clamp(state.satiety - SATIETY_DECAY_AMOUNT, 0, 100);
      saveState(state);
      renderStats();
    }, SATIETY_DECAY_INTERVAL_MS);

    renderStats();
    renderLog();
    initWeatherSubtitle();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
