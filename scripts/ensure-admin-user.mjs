#!/usr/bin/env node
/** 首次部署创建管理员；已存在则仅补齐权限，不重置密码 */
import "../server/lib/env.mjs";
import { ensureAdminUser } from "../server/lib/user-auth.mjs";
import { env } from "../server/lib/env.mjs";

const username = process.argv[2] || env("ADMIN_USERNAME", "bolo");
const password = process.argv[3] || env("ADMIN_PASSWORD", "123456");

try {
  const result = ensureAdminUser(username, password);
  if (result.created) {
    console.log(`✓ 已创建管理员: ${result.user.username}`);
  } else if (result.promoted) {
    console.log(`✓ 已将 ${result.user.username} 设为管理员（保留原密码）`);
  } else {
    console.log(`✓ 管理员 ${result.user.username} 已就绪`);
  }
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}
