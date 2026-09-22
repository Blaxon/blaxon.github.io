(() => {
    "use strict";

    // Site-level override of the theme's theme.js: no light/dark toggle,
    // the site is always dark. Keeps the mobile menu blur behavior, which
    // is unrelated to theming.

    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");

    requestAnimationFrame(() => document.body.classList.remove("notransition"));

    window.addEventListener("DOMContentLoaded", () => {
        const cbox = document.getElementById("menu-trigger");

        cbox.addEventListener("change", function () {
            const area = document.querySelector(".wrapper");
            if (this.checked) return area.classList.add("blurry");
            area.classList.remove("blurry");
        });
    });
})();
