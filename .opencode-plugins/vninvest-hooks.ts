import type { PluginInput } from "@opencode-ai/plugin"
import * as fs from "fs"
import * as path from "path"

export const VNInvestHooksPlugin = async ({
  client,
  $,
  directory,
  worktree,
}: PluginInput) => {
  const worktreePath = worktree || directory

  const log = (level: "debug" | "info" | "warn" | "error", message: string) =>
    client.app.log({ body: { service: "vninvest-hooks", level, message } })

  const isLegacyPath = (filePath: string): boolean => {
    const relative = path.relative(worktreePath, path.resolve(worktreePath, filePath)).replace(/\\/g, "/");
    return relative.startsWith("backend/") || relative.startsWith("frontend/");
  }

  const vnRegex = /[áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/i;

  const hasRawVietnamese = (content: string): boolean => {
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
        continue;
      }
      if (vnRegex.test(line)) {
        return true;
      }
    }
    return false;
  }

  return {
    "tool.execute.before": async (input: { tool: string; args?: Record<string, unknown> }) => {
      // Check for legacy directory access
      const filePath = (input.args?.filePath || input.args?.file_path || input.args?.path || input.args?.TargetFile) as string | undefined;
      if (filePath && isLegacyPath(filePath)) {
        log("error", `[VNInvest] BLOCKED: Sửa đổi trên đường dẫn legacy bị cấm: ${filePath}`);
        throw new Error(`QUY ĐỊNH BẮT BUỘC (AGENTS.md): Thư mục legacy 'backend/' và 'frontend/' đã bị deprecated. Vui lòng chuyển sang phát triển tại 'packages/core' (backend) và 'packages/web' (frontend).`);
      }

      // Check for raw Vietnamese text in React components
      if (input.tool === "write_file" || input.tool === "write" || input.tool === "replace_file_content" || input.tool === "multi_replace_file_content") {
        if (filePath && filePath.match(/\.(ts|tsx|js|jsx)$/) && !filePath.includes("i18n") && !filePath.includes("test") && !filePath.includes("spec")) {
          const content = (input.args?.CodeContent || input.args?.content || input.args?.ReplacementContent || "") as string;
          if (hasRawVietnamese(content)) {
            log("warn", `[VNInvest] WARNING: Phát hiện text Tiếng Việt viết trực tiếp (hardcoded) trong file: ${filePath}`);
            log("warn", `[VNInvest] Hãy sử dụng hệ thống i18n tại 'packages/web/src/i18n/vi.js' để đảm bảo hiển thị chuẩn.`);
          }
        }
      }
    },

    "permission.ask": async (event: { tool: string; args: unknown }) => {
      // Check target files in permissions prompt
      const argsObj = event.args as Record<string, unknown> | undefined;
      const filePath = (argsObj?.filePath || argsObj?.file_path || argsObj?.path || argsObj?.TargetFile || argsObj?.Target) as string | undefined;
      
      if (filePath && isLegacyPath(filePath)) {
        return {
          approved: false,
          reason: "QUY ĐỊNH BẮT BUỘC (AGENTS.md): Thư mục legacy 'backend/' và 'frontend/' đã bị deprecated. Vui lòng chuyển sang phát triển tại 'packages/core' và 'packages/web'."
        }
      }

      // Check command strings in bash permission asks
      if (event.tool === "bash" || event.tool === "command") {
        const cmd = String(argsObj?.command || event.args || "");
        if (cmd.includes("backend/") || cmd.includes("frontend/")) {
          if (cmd.match(/(rm|mv|cp|mkdir|touch|vi|nano|echo|cat|git add|git commit|python|node)/)) {
            return {
              approved: false,
              reason: "QUY ĐỊNH BẮT BUỘC: Không thực hiện các lệnh chỉnh sửa hoặc chạy code trên thư mục legacy (backend/ hoặc frontend/)."
            }
          }
        }
      }

      return { approved: undefined }
    }
  }
}

export default VNInvestHooksPlugin;
