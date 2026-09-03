(function () {
  var STORAGE_KEY = "fenguan_state_v1";
  var LOG_LIMIT = 20;
  var SLURP_COOLDOWN_MS = 1200;
  var ORDER_COOLDOWN_MS = 2000;

  function defaultState() {
    return {
      version: 1,
      visits: 0,
      hunger: 60,
      mood: 60,
      tickets: 0,
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
      if (!parsed || parsed.version !== 1) return defaultState();
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
      logEmpty: document.querySelector("[data-fenguan-log-empty]"),
      hint: document.querySelector("[data-fenguan-hint]"),
      slurpBtn: document.querySelector("[data-fenguan-slurp]"),
      messageBtn: document.querySelector("[data-fenguan-message]"),
      orderBtns: document.querySelectorAll("[data-fenguan-order]"),
      stats: {
        hunger: document.querySelector('[data-fenguan-stat="hunger"]'),
        mood: document.querySelector('[data-fenguan-stat="mood"]'),
        tickets: document.querySelector('[data-fenguan-stat="tickets"]'),
        visits: document.querySelector('[data-fenguan-stat="visits"]'),
      },
    };

    // 统一的事件记录入口：v1 只写本地日志，未来要接跨访客共享数据，
    // 只需要在这里补一次上报，调用点（点单/嗦粉）不用改。
    function recordEvent(text) {
      state.log.unshift({ text: text, at: Date.now() });
      state.log = state.log.slice(0, LOG_LIMIT);
      saveState(state);
      renderLog();
    }

    function renderStats() {
      if (els.stats.hunger) els.stats.hunger.style.width = state.hunger + "%";
      if (els.stats.mood) els.stats.mood.style.width = state.mood + "%";
      if (els.stats.tickets) els.stats.tickets.textContent = state.tickets + " 张";
      if (els.stats.visits) els.stats.visits.textContent = state.visits + " 次";

      els.orderBtns.forEach(function (btn) {
        var id = btn.getAttribute("data-fenguan-order");
        var item = findMenuItem(id);
        if (item && state.tickets < item.cost) {
          btn.setAttribute("data-fenguan-affordable", "false");
        } else {
          btn.setAttribute("data-fenguan-affordable", "true");
        }
      });
    }

    function renderLog() {
      if (!els.log) return;
      els.log.innerHTML = "";
      if (state.log.length === 0) {
        var li = document.createElement("li");
        li.className = "text-xs text-muted";
        li.textContent = "还没什么动静，先嗦一口暖暖场。";
        els.log.appendChild(li);
        return;
      }
      state.log.forEach(function (entry) {
        var li = document.createElement("li");
        li.textContent = entry.text;
        els.log.appendChild(li);
      });
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

    function withCooldown(btn, ms) {
      if (!btn) return;
      btn.disabled = true;
      setTimeout(function () {
        btn.disabled = false;
      }, ms);
    }

    function slurp() {
      state.slurpCount += 1;
      state.tickets += 1;
      state.hunger = clamp(state.hunger - 3, 0, 100);
      state.mood = clamp(state.mood + 4, 0, 100);

      var texts = [
        "嗦了一口热汤，从喉咙一直暖到胃里。",
        "老板顺手多舀了一勺汤，说是不要钱。",
        "隔壁桌在讨论今天的球赛，你也跟着笑了两声。",
        "风扇吱呀吱呀转着，粉还是很烫，慢慢嗦。",
      ];
      recordEvent(pickRandom(texts));
      renderStats();
      saveState(state);
      withCooldown(els.slurpBtn, SLURP_COOLDOWN_MS);
    }

    function order(id) {
      var item = findMenuItem(id);
      if (!item) return;

      if (state.tickets < item.cost) {
        showHint("钱包干瘪，先去嗦粉攒点人气。");
        return;
      }

      state.tickets -= item.cost;
      state.ordersCount += 1;
      state.hunger = clamp(state.hunger + item.hunger, 0, 100);
      state.mood = clamp(state.mood + item.mood, 0, 100);

      var texts = item.flavorTexts && item.flavorTexts.length
        ? item.flavorTexts
        : ["一碗" + item.name + "端上来了。"];
      recordEvent("点了一碗" + item.name + "：" + pickRandom(texts));
      renderStats();
      saveState(state);
      showHint("");

      var btn = document.querySelector(
        '[data-fenguan-order="' + id + '"]'
      );
      withCooldown(btn, ORDER_COOLDOWN_MS);
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

    renderStats();
    renderLog();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
