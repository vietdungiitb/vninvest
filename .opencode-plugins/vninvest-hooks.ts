import { Plugin } from "@opencode/plugin"
import * as path from "path"

const isLegacyPath = (worktreePath: string, filePath: string): boolean => {
  const rel2 = path.relative(worktreePath, path.resolve(worktreePath, filePath)).replace(/\\/g, "/")
  return rel2.startsWith("backend/") || rel2.startsWith("frontend/")
}

const vnRegex = /[áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờỡợúùủũụưứừửữựýỳỷỹỵđ]/i

const hasRawVietnamese = (content: string): boolean => {
  const lines = content.split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
      continue
    }
    if (vnRegex.test(line)) {
      return true
    }
  }
  return false
}

const legacyWriteError =
  "QUY ĐỊNH BẮT BUỘC (AGENTS.md): Thư mục legacy 'backend/' và 'frontend/' đã bị deprecated. Vui lòng chuyển sang phát triển tại 'packages/core' (backend) và 'packages/web' (frontend)."
const legacyPermissionReason =
  "QUY ĐỊNH BẮT BUỘC (AGENTS.md): Thư mục legacy 'backend/' và 'frontend/' đã bị deprecated. Vui lòng chuyển sang phát triển tại 'packages/core' và 'packages/web'."
const legacyBashReason =
  "QUY ĐỊNH BẮT BUỘC: Không thực hiện các lệnh chỉnh sửa hoặc chạy code trên thư mục legacy (backend/ hoặc frontend/)."

type UnknownRecord = Record<string, unknown>

const getStringField = (obj: UnknownRecord, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === "string" && value.length > 0) {
      return value
    }
  }
  return undefined
}

const PATH_KEYS = ["filePath", "file_path", "path", "TargetFile", "Target", "filename", "file", "resource"]
const COMMAND_KEYS = ["command", "cmd"]

const collectFields = (event: unknown, keys: string[]): string[] => {
  const out: string[] = []
  const visit = (value: unknown, depth: number): void => {
    if (depth > 3 || value === null || value === undefined) {
      return
    }
    if (typeof value === "string") {
      if (value.length > 0 && value.length < 4096) {
        out.push(value)
      }
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item, depth + 1)
      }
      return
    }
    if (typeof value === "object") {
      const record = value as UnknownRecord
      for (const key of keys) {
        const field = record[key]
        if (typeof field === "string" && field.length > 0) {
          out.push(field)
        }
      }
      visit(record["resources"], depth + 1)
      visit(record["input"], depth + 1)
      visit(record["args"], depth + 1)
    }
  }
  visit(event, 0)
  return out
}

// Like isLegacyPath but for a bare candidate string (no base to resolve
// against): relativize against worktreePath first so that
// `packages/core/backend/...` (new code) is NOT mistaken for legacy `backend/`.
const isLegacyCandidate = (worktreePath: string, text: string): boolean => {
  const normalized = text.replace(/\\/g, "/").replace(/^\.\/+/, "")
  const wt = worktreePath.replace(/\\/g, "/").replace(/\/+$/, "")
  let rel = normalized
  if (normalized.toLowerCase().startsWith(wt.toLowerCase() + "/")) {
    rel = normalized.slice(wt.length + 1)
  } else if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith("/")) {
    return false
  }
  return rel === "backend" || rel === "frontend" || rel.startsWith("backend/") || rel.startsWith("frontend/")
}

export const VNInvestHooksPlugin = Plugin.define({
  id: "vninvest-hooks",
  async setup(ctx) {
    const worktreePath = ctx.location.directory

    const log = (level: "debug" | "info" | "warn" | "error", message: string): void => {
      const line = `[VNInvest] ${message}`
      if (level === "error") {
        console.error(line)
      } else if (level === "warn") {
        console.warn(line)
      } else {
        console.log(line)
      }
    }

    await ctx.tool.hook("execute.before", (event) => {
      const e = event as unknown as UnknownRecord
      const toolName = String(e["tool"] ?? e["toolName"] ?? e["id"] ?? e["name"] ?? "")
      const rawInput = ((e["input"] ?? e["args"] ?? e["data"] ?? e) as UnknownRecord) ?? {}
      const filePath =
        getStringField(rawInput, ["filePath", "file_path", "path", "TargetFile", "Target", "filename", "file"]) ??
        getStringField(e, ["filePath", "file_path", "path", "TargetFile", "Target"])

      if (filePath && isLegacyPath(worktreePath, filePath)) {
        log("error", `[VNInvest] BLOCKED: Sửa đổi trên đường dẫn legacy bị cấm: ${filePath}`)
        throw new Error(legacyWriteError)
      }

      const writeTools = new Set(["write_file", "write", "replace_file_content", "multi_replace_file_content", "edit", "create"])
      if (writeTools.has(toolName) || /write|edit|replace|create/i.test(toolName)) {
        if (filePath && filePath.match(/\.(ts|tsx|js|jsx)$/) && !filePath.includes("i18n") && !filePath.includes("test") && !filePath.includes("spec")) {
          const content =
            getStringField(rawInput, ["CodeContent", "content", "ReplacementContent", "text", "body", "data"]) ?? ""
          if (content && hasRawVietnamese(content)) {
            log("warn", `[VNInvest] WARNING: Phát hiện text Tiếng Việt viết trực tiếp (hardcoded) trong file: ${filePath}`)
            log("warn", "[VNInvest] Hãy sử dụng hệ thống i18n tại 'packages/web/src/i18n/vi.js' để đảm bảo hiển thị chuẩn.")
          }
        }
      }
    })

    await ctx.permission.hook("evaluate", (event) => {
      const e = event as unknown as UnknownRecord
      const pathCandidates = collectFields(event, PATH_KEYS)

      for (const text of pathCandidates) {
        if (isLegacyCandidate(worktreePath, text)) {
          ;(event as unknown as UnknownRecord)["effect"] = "deny"
          ;(event as unknown as UnknownRecord)["reason"] = legacyPermissionReason
          log("error", `[VNInvest] BLOCKED: Sửa đổi trên đường dẫn legacy bị cấm: ${text}`)
          return
        }
      }

      const actionText = String(e["action"] ?? "").toLowerCase()
      if (actionText.includes("bash") || actionText.includes("shell") || actionText.includes("command") || actionText.includes("execute")) {
        const joined = collectFields(event, COMMAND_KEYS).join("\n")
        const hasVerb = /(rm|mv|cp|mkdir|touch|vi|nano|echo|cat|git add|git commit|python|node)/.test(joined)
        if (hasVerb) {
          // Chi chan khi token duong dan that su tro vao legacy backend//frontend/
          // (packages/core/backend/... la code moi -> cho phep; V1 so sanh chuoi thoi
          // nen vo tinh chan ca duong dan moi khi go bang dau /).
          const tokens = joined.split(/[\s"'`;,|&(){}[\]<>]+/).filter(Boolean)
          const legacyHit = tokens.find((t) => isLegacyCandidate(worktreePath, t))
          if (legacyHit) {
            ;(event as unknown as UnknownRecord)["effect"] = "deny"
            ;(event as unknown as UnknownRecord)["reason"] = legacyBashReason
            log("error", "[VNInvest] BLOCKED: lệnh chỉnh sửa hoặc chạy code trên thư mục legacy bị cấm.")
          }
        }
      }
    })
  },
})

export default VNInvestHooksPlugin
