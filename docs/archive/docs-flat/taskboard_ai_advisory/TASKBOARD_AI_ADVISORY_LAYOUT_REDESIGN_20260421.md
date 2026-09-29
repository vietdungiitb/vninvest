# Taskboard: AI Advisory Layout Redesign (2026-04-21)

## Muc tieu
Thuc thi bo cuc moi cho AI Advisory theo quyet dinh:
- Cot phai la WhaleSymbolSidebar.
- 2 cot trai cho WhaleAdvisoryCommandPanel.
- Module con lai bo tri hai hoa, giam cuon sau.

---

## Slice 1 - Layout shell va Header compact
| Task ID | Mo ta | Status | Owner |
| :--- | :--- | :--- | :--- |
| ADL-FE-01 | Canh top spacing sat menu ngang theo chuan Whale Alerts | [ ] | FE |
| ADL-FE-02 | Dung main grid 3 cot cho row chinh | [ ] | FE |
| ADL-FE-03 | Tao support row cho bubble + module phu tro | [ ] | FE |

## Slice 2 - Command panel span 2 cot
| Task ID | Mo ta | Status | Owner |
| :--- | :--- | :--- | :--- |
| ADL-FE-04 | Dat CommandPanel span 2 cot trai | [ ] | FE |
| ADL-FE-05 | Tang line-height va readability cho bai tu van dai | [ ] | FE |
| ADL-FE-06 | Dam bao empty/loading state ro rang trong panel | [ ] | FE |

## Slice 3 - Sidebar cot phai
| Task ID | Mo ta | Status | Owner |
| :--- | :--- | :--- | :--- |
| ADL-FE-07 | Chuyen WhaleSymbolSidebar sang cot 3 | [ ] | FE |
| ADL-FE-08 | Sticky header + scroll body doc lap cho sidebar | [ ] | FE |
| ADL-FE-09 | Kiem tra pagination/search khong vo layout | [ ] | FE |

## Slice 4 - Support modules can bang
| Task ID | Mo ta | Status | Owner |
| :--- | :--- | :--- | :--- |
| ADL-FE-10 | Dat WhaleBubbleChart o panel trai rong cua tang duoi | [ ] | FE |
| ADL-FE-11 | Tao tab support panel ben phai (Telemetry/Risk/History) | [ ] | FE |
| ADL-FE-12 | Giu state tab khi doi symbol | [ ] | FE |

## Slice 5 - Responsive + hardening
| Task ID | Mo ta | Status | Owner |
| :--- | :--- | :--- | :--- |
| ADL-FE-13 | Breakpoint md/sm chuyen tu 3 cot sang 2/1 cot | [ ] | FE |
| ADL-FE-14 | Tranh double-scroll va overflow break | [ ] | FE |
| ADL-FE-15 | QA visual parity voi Whale Alerts | [ ] | QA |

## Slice 6 - Release gate
| Task ID | Mo ta | Status | Owner |
| :--- | :--- | :--- | :--- |
| ADL-QA-01 | Verify runtime khong co loi JS moi | [ ] | QA |
| ADL-QA-02 | Verify first viewport hien du panel cot loi | [ ] | QA |
| ADL-REL-01 | Rebuild frontend container + smoke test route /ai-advisory | [ ] | DevOps |

---

## Definition of Done
- [ ] Cot phai la WhaleSymbolSidebar tren desktop.
- [ ] WhaleAdvisoryCommandPanel span 2 cot trai va doc duoc bai dai.
- [ ] Bubble chart va module phu tro hien thi can bang, khong day trang qua sau.
- [ ] Responsive pass cac moc 1920, 1440, 1280, 1024, 768, 390.
- [ ] Audit ledger + progress dashboard da duoc cap nhat.
