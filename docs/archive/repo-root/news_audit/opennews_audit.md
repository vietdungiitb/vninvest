### Audit: OpenNews-main so với dự án vninvest

**Ngày audit**: $(date +%Y-%m-%d %H:%M)  
**Mô tả**: Phân tích toàn bộ opennews-main (structure, README, configs, code) để so sánh similarities/differences và features khả dụng. Không sửa code.

Dựa trên việc đọc toàn bộ cấu trúc thư mục, README (EN/CN), requirements.txt, main.py, config.py, web/server.py, config/sources.yaml, config/llm.yaml và các file liên quan trong **opennews-main/**, đây là dự án **OpenNews**: Một hệ thống phân tích tin tức tài chính thời gian thực sử dụng pipeline LangGraph. Nó thu thập tin từ nhiều nguồn (NewsNow API, seeds JSONL), xử lý NLP (FinBERT embedding, topic clustering, entity extraction, zero-shot classification), tính điểm ảnh hưởng (DK-CoT score 0-100), lưu vào PostgreSQL + Neo4j graph DB + Redis memory. Có web dashboard Vue.js (Vite) + API đơn giản (Python HTTP server) để query data và generate shareable PNG snapshots.

#### **Điểm giống (Similarities)**:
1. **Chủ đề tài chính/finance-focused**:
   - Cả hai đều liên quan thị trường tài chính: vninvest là portfolio management/stock trading (VN stocks, whale scoring, order flow, realtime updates); OpenNews là financial news analysis (impact scoring, topics như policy/macro_economy/company_event).
   
2. **Tech stack Python-heavy backend**:
   - vninvest: Django (models, views, celery tasks, realtime consumers WebSocket).
   - OpenNews: Pure Python (LangGraph pipeline, APScheduler, transformers/HuggingFace models). Cả hai dùng PostgreSQL (vninvest implicit qua Django ORM; OpenNews explicit psycopg2), Redis (vninvest realtime?; OpenNews temporal memory).

3. **Realtime/periodic processing**:
   - vninvest: Celery tasks, WebSocket (portfolio/realtime/order_flow).
   - OpenNews: Polling scheduler (5min intervals), memory window (30 days rolling).

4. **Data persistence & querying**:
   - Cả hai có DB querying APIs (vninvest: Django URLs/views/serializers; OpenNews: /api/batches, /api/records với filters như hours/score).

5. **Multi-source data**:
   - vninvest: VN stock data, user portfolio, emails.
   - OpenNews: Financial news APIs/seeds. No user data.

6. **Frontend presence**:
   - vninvest: React (App.jsx, components/pages).
   - OpenNews: Vue.js (App.vue, Vite build).

#### **Điểm khác (Differences)**:
| Aspect | vninvest (Current) | OpenNews-main |
|--------|--------------------|---------------|
| **Core purpose** | Stock portfolio/trading app (user auth, orders, whale alerts, analytics). Full-stack trading platform với mobile React Native. | News analysis pipeline. Không có user management/trading; chỉ ingest/process news → graph/DB → dashboard. |
| **Architecture** | Monolith Django + React + RN mobile. Heavy views/services (ai_service, gmail_service). | Micro-pipeline (LangGraph agents: classifier/feature/memory/report) + lightweight web server. Standalone, Docker-compose ready (PG/Neo4j/Redis). |
| **AI/ML** | AI context/options/service (likely LLM for trading insights). | Heavy NLP/ML: FinBERT embedding, BERT-NER, DeBERTa classification, topic modeling (BERTopic/HDBSCAN), LLM topic refine (GPT-4o-mini), Neo4j graph upsert. |
| **Data sources** | VN stock data, user portfolio, emails. | Financial news APIs/seeds. |
| **Output/Features** | Trading UI, realtime stock/order_flow, email verification. | News dashboard (topics/scores/charts), PNG share snapshots (playwright render), bilingual (zh/en). |
| **Infra** | Django ASGI/WSGI/Celery. No graph DB visible. | No framework; custom scheduler + Neo4j for KG (knowledge graph). |
| **Scale/Deployment** | VSCode dev (start_backend.ps1). | Docker-native, production-ready (APScheduler, caching). |
| **Frontend** | React SPA. | Vue 3 + Vite (dist build served by Python server). |
| **Size/Complexity** | Large (sprints/docs heavy, 100+ files). | Compact (~50 files, focused pipeline). |

#### **Tính năng có thể sử dụng/integrate vào vninvest** (gợi ý discussion):
Những features này phù hợp bổ sung cho vninvest (trading app cần news insights để whale scoring/order flow):
1. **News ingestion pipeline** (ingest/news_fetcher.py): Thu thập news từ NewsNow/multi-sources → classify/topics. Integrate vào backend/tasks.py để enrich stock data với news impact.
2. **NLP/Impact scoring** (agents/classifier_agent.py, llm/, nlp/): FinBERT embedding + DK-CoT score (stock/sentiment/policy weights). Dùng cho whale_scoring.py hoặc ai_service.py để score news impact lên VN stocks.
3. **Knowledge Graph (Neo4j)** (graph/neo4j_client.py): Lưu news entities/topics → query subgraph. Bổ sung cho analytics.py (e.g., event graphs ảnh hưởng portfolio).
4. **Temporal memory (Redis)**: Rolling window trends (30 days). Tương tự realtime/ để track news trends cho order_flow.
5. **Shareable PNG snapshots** (share/png_renderer.py): Generate image reports (playwright HTML→PNG, cached). Dùng cho dashboard/email alerts (giống gmail_service).
6. **Bilingual topics** (zh/en labels via LLM). vninvest có i18n/ → add news labels cho VN/INT users.
7. **Web APIs light** (server.py): Simple query/filter (hours/score). Copy pattern cho thêm news endpoints vào urls_stock.py.
8. **Docker setup**: docker-compose cho PG/Neo4j/Redis → standardize dev/prod vs current ps1 scripts.
9. **Scheduler polling** (scheduler/polling_job.py): Robust periodic jobs (5min) → improve tasks.py.

**Ưu tiên cao**: News scoring + KG để boost ai_service/whale_scoring (financial news trực tiếp ảnh hưởng trading decisions). Dự án vninvest có thể evolve thành "trading + news intelligence" platform.

**Discussion notes**:  
- Thêm section này để ghi chú feedback/chỉnh sửa.  
- File này dùng để thảo luận kế hoạch integrate (không sửa code vninvest).