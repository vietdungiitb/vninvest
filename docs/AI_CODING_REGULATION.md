# AI Coding Regulation: Explicit Consent Only

This document defines the mandatory interaction protocol between the AI (Antigravity) and the USER for the VNInvest repository.

## 1. The Golden Rule
**Antigravity MUST NOT modify any source code files without explicit, affirmative consent from the USER.**

## 2. Default State: Audit & Documentation
*   By default, all AI activities are restricted to **Audit and Planning** only.
*   Research findings, technical audits, and implementation plans must be presented as Markdown documents (artifacts) or text responses.
*   Proposed code changes should be presented as snippets or description within these documents, not applied to the actual codebase.

## 3. Workflow for Code Modification
1.  **Research**: AI analyzes the request and researches the codebase.
2.  **Audit/Plan**: AI produces a report or implementation plan.
3.  **User Review**: USER reviews the documentation.
4.  **Explicit Command**: AI waits for a specific command to proceed (e.g., "Code đi", "Proceed with implementation", "Thực hiện").
5.  **Execution**: Only after the command is received, the AI may use code-editing tools.

## 4. Consequences of Violation
*   If code is modified without explicit consent, the AI must acknowledge the error and offer a rollback.
*   The AI must prioritize integrity and user control over speed of delivery.

---
*Last Updated: 2026-04-17*
