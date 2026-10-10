/*
 * VNInvest Admin — điều khiển sidebar.
 *
 * Vì sao không dùng `admin/js/nav_sidebar.js` của Django
 * --------------------------------------------------
 * Đã **đọc** file đó (`django/contrib/admin/static/admin/js/nav_sidebar.js`):
 * hàm `initSidebarQuickFilter()` lọc bằng
 * `navSidebar.querySelectorAll('th[scope=row] a')` rồi ẩn `o.node.parentNode.parentNode`.
 * Sidebar mới dùng `<li class="vn-nav-item" data-filterable-text="…">` — **không có**
 * `th[scope=row]` ⇒ `options` rỗng ⇒ mọi lần gõ sẽ gắn class `no-results`
 * (script kiểm tra `matches`, thấy false nên coi như không tìm thấy).
 * Đó là hộp lọc **luôn báo không có kết quả** — hỏng ngay từ lần gõ đầu tiên.
 *
 * Nên thay bằng script này: giữ nguyên **khoá localStorage** của Django để trạng
 * thái mở/đóng vẫn tương thích với phiên trước, và lọc theo
 * `data-filterable-text` (không phụ thuộc cấu trúc bảng).
 */
(function () {
  "use strict";

  var TOGGLE_KEY = "django.admin.navSidebarIsOpen";
  var FILTER_KEY = "django.admin.navSidebarFilterValue";

  /* ── Mở / đóng sidebar ──────────────────────────────────────────────── */
  var toggle = document.getElementById("toggle-nav-sidebar");
  if (toggle !== null) {
    var nav = document.getElementById("nav-sidebar");
    var main = document.getElementById("main");
    var stored = localStorage.getItem(TOGGLE_KEY);
    var isOpen = stored === null ? true : stored === "true";
    main.classList.toggle("shifted", isOpen);
    nav.setAttribute("aria-expanded", isOpen ? "true" : "false");
    toggle.addEventListener("click", function () {
      isOpen = !isOpen;
      localStorage.setItem(TOGGLE_KEY, isOpen ? "true" : "false");
      main.classList.toggle("shifted", isOpen);
      nav.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  /* ── Lọc nhanh ──────────────────────────────────────────────────────── */
  var input = document.getElementById("nav-filter");
  var sidebar = document.getElementById("nav-sidebar");
  if (!input || !sidebar) {
    return;
  }

  var items = sidebar.querySelectorAll("[data-filterable-text]");
  // Nhóm cha để ẩn luôn tiêu đề nhóm khi mọi mục bên trong đều bị lọc bỏ,
  // tránh để lại nhóm rỗng trong menu.
  var groups = sidebar.querySelectorAll(".vn-nav-group");

  function apply() {
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
      var visible = group.querySelectorAll("[data-filterable-text]:not([hidden])").length;
      group.hidden = visible === 0;
    });

    input.classList.toggle("no-results", needle !== "" && matched === 0);
    try {
      sessionStorage.setItem(FILTER_KEY, needle);
    } catch (err) {
      /* Safari private mode chặn sessionStorage — bộ lọc vẫn chạy, chỉ mất
         khả năng nhớ giá trị. Không được để việc này làm hỏng menu. */
    }
  }

  ["input", "change", "keyup"].forEach(function (evt) {
    input.addEventListener(evt, apply, false);
  });
  // D08 §13: Esc đóng hộp thoại / huỷ thao tác — ở đây là xoá bộ lọc.
  input.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      input.value = "";
      apply();
    }
  });

  var previous = null;
  try {
    previous = sessionStorage.getItem(FILTER_KEY);
  } catch (err) {
    previous = null;
  }
  if (previous) {
    input.value = previous;
  }
  apply();
})();
