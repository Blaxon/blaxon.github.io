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

  // 兜底：menu.yaml 里某个品类没配 slurpTexts，或碗里的品类在当前菜单里找不到时用这组通用文案。
  var DEFAULT_SLURP_TEXTS = [
    "嗦了一口热汤，从喉咙一直暖到胃里。",
    "老板顺手多舀了一勺汤，说是不要钱。",
    "隔壁桌在讨论今天的球赛，你也跟着笑了两声。",
    "风扇吱呀吱呀转着，粉还是很烫，慢慢嗦。",
  ];

  // 天气驱动 subtitle：固定用某地坐标（不做浏览器定位，不弹权限、
  // 不暴露访客位置），走 Open-Meteo（免 key、支持 CORS，静态站能直接调）。
  var WEATHER_LAT = 29.03;
  var WEATHER_LON = 111.70;
  var WEATHER_API_URL =
    "https://api.open-meteo.com/v1/forecast?latitude=" + WEATHER_LAT +
    "&longitude=" + WEATHER_LON +
    "&current=temperature_2m,weather_code&timezone=Asia%2FShanghai";
  var WEATHER_CACHE_KEY = "fenguan_weather_v2"; // v2：新增 hour 字段（巷子当地时间），沿用"版本不匹配就重置"策略
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

  // subtitle = [时间][天气][气温]，三段拼成一句话，所以每段都是不带句号的分句片段，
  // 拼接时用逗号连接、结尾统一补句号（见 buildWeatherSubtitle）。

  // 按巷子所在地（常德）当地小时分 7 段，覆盖 0-23 点不重叠。
  var TIME_TEXTS = {
    lateNight: [ // 0-3 点
      "后半夜的巷子静悄悄的，粉馆的灯是留给下夜班打工人的",
      "夜深了，巷子里没剩几家还开着门，就等着夜班打工人回来嗦一碗",
      "后半夜的巷子里，只剩几个刚下夜班的打工人还在嗦粉",
    ],
    dawn: [ // 4-7 点
      "天刚蒙蒙亮，巷子还没热闹起来，只有背着书包的学生匆匆走过",
      "凌晨的巷口安安静静的，几个赶早班的打工人蹲在摊边等粉",
      "凌晨的巷子里，已经有学生边啃着粉边往学校赶，怕迟到",
    ],
    morning: [ // 8-10 点
      "上午的巷子渐渐热闹起来，打工人行色匆匆地赶着去上班",
      "清早的巷子飘着头一锅汤的香气，几个打工人排着队等一碗垫肚子的粉",
      "上午的巷子里，赶着打卡的打工人端着粉边走边嗦",
    ],
    noon: [ // 11-13 点
      "晌午的巷子人声正闹，抢着午休的打工人排起了队",
      "正是晌午，粉馆里坐得满满当当，刚放学的中小学生占了半张桌子",
      "晌午的巷子挤满了放学的中小学生和抢着午休的打工人，桌子都快坐不下了",
    ],
    afternoon: [ // 14-17 点
      "下午的巷子闲适得很，只有摸鱼的打工人溜达过来嗦碗粉",
      "过了饭点，巷子里安静了不少，偶尔有早退的学生蹦跳着路过",
      "下午的巷子里，几个放学早的中小学生蹭在桌边写作业，顺便嗦碗粉",
    ],
    dusk: [ // 18-20 点
      "傍晚的巷口亮起了灯笼，放学的学生背着书包挤在摊前",
      "天擦黑，烟火气渐渐飘起来，下班的打工人陆续往巷子里钻",
      "傍晚的巷口，刚下班的打工人三三两两地涌进来卸下一天的疲惫",
    ],
    evening: [ // 21-23 点
      "夜里的巷子灯火正旺，写字楼还亮着灯的打工人开始惦记这碗粉",
      "入夜后，巷子里的热闹刚刚好，写完作业的学生也来蹭一碗夜宵",
      "夜里的巷子里，加完班的打工人来嗦一碗，压一压一天的疲惫",
    ],
  };

  function timeToBucket(hour) {
    if (hour >= 0 && hour <= 3) return "lateNight";
    if (hour >= 4 && hour <= 7) return "dawn";
    if (hour >= 8 && hour <= 10) return "morning";
    if (hour >= 11 && hour <= 13) return "noon";
    if (hour >= 14 && hour <= 17) return "afternoon";
    if (hour >= 18 && hour <= 20) return "dusk";
    if (hour >= 21 && hour <= 23) return "evening";
    return null;
  }

  // WMO 天气码分组，映射成天气氛围分句（占位基调，后续再迭代）。
  var WEATHER_TEXTS = {
    clear: [
      "天很晴朗，风吹得人挺舒服",
      "天空干净得很，一点云都没有",
    ],
    cloudy: [
      "天阴沉沉的，云压得有点低",
      "云层厚厚的，天色显得有点闷",
    ],
    fog: [
      "雾气很重，看不清多远",
      "雾大得很，隔壁桌说话都听着闷闷的",
    ],
    drizzle: [
      "外头飘着毛毛雨，屋檐下滴滴答答",
      "细雨斜斜地下着，路面湿了一层",
    ],
    rain: [
      "外头下着雨，雨声哗哗的",
      "雨下得不小，屋檐水连成了线",
    ],
    snow: [
      "飘起了雪，难得一见",
      "雪落得悄无声息，地上薄薄一层",
    ],
    thunderstorm: [
      "外头打着雷，闪电时不时地亮一下",
      "雷声滚滚，没人愿意这时候出门",
    ],
  };

  // 气温分句，只在极端温度下追加，正常温度不加这一段——温度是按当天实际数据独立判断的，
  // 这段分句本身不该假设季节/时段，避免跟前面的时间/天气分句自相矛盾。
  var TEMP_TEXTS = {
    cold: [
      "天冷，多喝两口热汤才暖和",
      "天冷，呵出的白气比汤还多",
    ],
    hot: [
      "天热，风扇在头顶转得更卖力了",
      "天热，老板往汤里少放了一勺油辣椒",
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

    var parts = [];

    var bucket = typeof weather.hour === "number" ? timeToBucket(weather.hour) : null;
    if (bucket && TIME_TEXTS[bucket]) parts.push(pickRandom(TIME_TEXTS[bucket]));

    parts.push(pickRandom(WEATHER_TEXTS[category]));

    if (typeof weather.temp === "number") {
      if (weather.temp <= 5) {
        parts.push(pickRandom(TEMP_TEXTS.cold));
      } else if (weather.temp >= 32) {
        parts.push(pickRandom(TEMP_TEXTS.hot));
      }
    }

    return parts.join("，") + "。";
  }

  // 从 Open-Meteo 的 current.time（形如 "2026-09-04T23:15"，已按 timezone=Asia/Shanghai
  // 对齐巷子所在地的当地时间）里取出小时数，不用访客设备时间，也不用额外请求。
  function parseHourFromTime(time) {
    if (typeof time !== "string") return null;
    var match = time.match(/T(\d{1,2}):/);
    if (!match) return null;
    var hour = parseInt(match[1], 10);
    return isNaN(hour) ? null : hour;
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
        JSON.stringify({
          code: weather.code,
          temp: weather.temp,
          hour: weather.hour,
          fetchedAt: Date.now(),
        })
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
        var weather = {
          code: current.weather_code,
          temp: current.temperature_2m,
          hour: parseHourFromTime(current.time),
        };
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

      var bowlItem = findMenuItem(state.bowl.itemId);

      state.slurpCount += 1;
      state.bowl.remaining -= 1;
      state.satiety = clamp(state.satiety + SATIETY_PER_SLURP, 0, 100);
      state.mood = clamp(state.mood + 4, 0, 100);
      if (state.bowl.remaining <= 0) state.bowl = null;

      var texts =
        bowlItem && bowlItem.slurpTexts && bowlItem.slurpTexts.length
          ? bowlItem.slurpTexts
          : DEFAULT_SLURP_TEXTS;
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
