/*
 * VNInvest Admin — điều khiển sidebar chuẩn GitHub Console.
 *
 * Tính năng:
 *   1. Đóng/mở toàn bộ sidebar (ghi nhớ trạng thái qua localStorage)
 *   2. Accordion Collapsible cho từng nhóm nghiệp vụ (ghi nhớ qua localStorage)
 *   3. Tự động mở nhóm chứa item đang active
 *   4. Lọc nhanh chức năng theo data-filterable-text, tự mở nhóm có kết quả
 *   5. Phím tắt '/' để tìm kiếm nhanh, 'Esc' để xoá bộ lọc
 */
(function () {
  "use strict";

  var SIDEBAR_TOGGLE_KEY = "django.admin.navSidebarIsOpen";
  var FILTER_KEY = "django.admin.navSidebarFilterValue";
  var COLLAPSED_GROUPS_KEY = "vnadmin.collapsed_nav_groups";

  /* ── 1. Đóng / mở toàn bộ sidebar (Tích hợp header & sidebar, triệt tiêu cột cũ) ─── */
  var toggle = document.getElementById("toggle-nav-sidebar");
  var collapseBtn = document.getElementById("vn-sidebar-collapse-btn");
  var headerToggleBtn = document.getElementById("vn-header-sidebar-toggle");
  var floatingToggleBtn = document.getElementById("vn-sidebar-floating-toggle");
  var nav = document.getElementById("nav-sidebar");
  var main = document.getElementById("main");

  if (nav && main) {
    var stored = localStorage.getItem(SIDEBAR_TOGGLE_KEY);
    var isOpen = stored === null ? true : stored === "true";
    main.classList.toggle("shifted", isOpen);
    nav.setAttribute("aria-expanded", isOpen ? "true" : "false");
    if (headerToggleBtn) headerToggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    if (floatingToggleBtn) floatingToggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");

    function doToggle() {
      isOpen = !isOpen;
      localStorage.setItem(SIDEBAR_TOGGLE_KEY, isOpen ? "true" : "false");
      main.classList.toggle("shifted", isOpen);
      nav.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (headerToggleBtn) headerToggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (floatingToggleBtn) floatingToggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }

    if (toggle) toggle.addEventListener("click", doToggle);
    if (collapseBtn) collapseBtn.addEventListener("click", doToggle);
    if (headerToggleBtn) headerToggleBtn.addEventListener("click", doToggle);
    if (floatingToggleBtn) floatingToggleBtn.addEventListener("click", doToggle);

    // Phím tắt '[' để đóng/mở sidebar khi không gõ trong ô nhập liệu
    window.addEventListener("keydown", function (e) {
      if (e.key === "[" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        doToggle();
      }
    });
  }

  if (!nav) {
    return;
  }

  /* ── 2. Collapsible Accordion từng nhóm ─────────────────────────────────── */
  function getCollapsedGroups() {
    try {
      var raw = localStorage.getItem(COLLAPSED_GROUPS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function setGroupCollapsed(groupKey, isCollapsed) {
    var state = getCollapsedGroups();
    state[groupKey] = isCollapsed;
    try {
      localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  var groupHeaders = nav.querySelectorAll(".vn-nav-group__header");
  var collapsedState = getCollapsedGroups();

  groupHeaders.forEach(function (btn) {
    var key = btn.getAttribute("data-group-toggle");
    var groupEl = btn.closest(".vn-nav-group");
    if (!groupEl || !key) return;

    // Kiểm tra xem nhóm có chứa mục đang được chọn không
    var hasActiveItem = groupEl.querySelector(".vn-nav-item--current") !== null;

    // Nếu có active item => BẮT BUỘC MỞ; nếu không => theo localStorage
    var isCollapsed = hasActiveItem ? false : Boolean(collapsedState[key]);

    if (isCollapsed) {
      groupEl.classList.add("is-collapsed");
      btn.setAttribute("aria-expanded", "false");
    } else {
      groupEl.classList.remove("is-collapsed");
      btn.setAttribute("aria-expanded", "true");
    }

    btn.addEventListener("click", function () {
      var currentlyCollapsed = groupEl.classList.contains("is-collapsed");
      var nextCollapsed = !currentlyCollapsed;
      groupEl.classList.toggle("is-collapsed", nextCollapsed);
      btn.setAttribute("aria-expanded", nextCollapsed ? "false" : "true");
      setGroupCollapsed(key, nextCollapsed);
    });
  });

  /* ── 3. Lọc nhanh chức năng ────────────────────────────────────────────── */
  var input = document.getElementById("nav-filter");
  if (!input) {
    return;
  }

  var items = nav.querySelectorAll("[data-filterable-text]");
  var groups = nav.querySelectorAll(".vn-nav-group");

  function applyFilter() {
    var raw = input.value || "";
    var needle = raw.trim().toLowerCase();
    var matched = 0;

    items.forEach(function (item) {
      var haystack = (item.getAttribute("data-filterable-text") || "").toLowerCase();
      var hit = needle === "" || haystack.indexOf(needle) !== -1;
      item.hidden = !hit;
      if (hit) {
        matched += 1;
      }
    });

    groups.forEach(function (group) {
      var visibleItems = group.querySelectorAll("[data-filterable-text]:not([hidden])").length;
      group.hidden = visibleItems === 0;

      // Khi đang tìm kiếm: tự động bung mở nhóm có kết quả
      if (needle !== "" && visibleItems > 0) {
        group.classList.remove("is-collapsed");
        var btn = group.querySelector(".vn-nav-group__header");
        if (btn) btn.setAttribute("aria-expanded", "true");
      } else if (needle === "") {
        // Khôi phục trạng thái đã lưu
        var key = group.getAttribute("data-group-key");
        var hasActive = group.querySelector(".vn-nav-item--current") !== null;
        var wasCollapsed = hasActive ? false : Boolean(collapsedState[key]);
        group.classList.toggle("is-collapsed", wasCollapsed);
        var headerBtn = group.querySelector(".vn-nav-group__header");
        if (headerBtn) headerBtn.setAttribute("aria-expanded", wasCollapsed ? "false" : "true");
      }
    });

    input.classList.toggle("no-results", needle !== "" && matched === 0);
    try {
      sessionStorage.setItem(FILTER_KEY, needle);
    } catch (err) {}
  }

  ["input", "change", "keyup"].forEach(function (evt) {
    input.addEventListener(evt, applyFilter, false);
  });

  /* ── 4. Phím tắt ──────────────────────────────────────────────────────── */
  window.addEventListener("keydown", function (e) {
    // Nhấn '/' khi không đang nhập ô input khác => focus vào search
    if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      e.preventDefault();
      input.focus();
      input.select();
    }
    // Nhấn 'Escape' khi đang focus ô search => xóa filter và unfocus
    if (e.key === "Escape" && document.activeElement === input) {
      input.value = "";
      applyFilter();
      input.blur();
    }
  });

  // Khôi phục giá trị bộ lọc nếu có trong sessionStorage
  try {
    var previous = sessionStorage.getItem(FILTER_KEY);
    if (previous) {
      input.value = previous;
      applyFilter();
    }
  } catch (err) {}
})();
