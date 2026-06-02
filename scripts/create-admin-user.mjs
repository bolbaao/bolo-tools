#!/usr/bin/env node
/**
 * 显式重置管理员密码（会覆盖已有账号密码）。
 * 日常启动请用 scripts/ensure-admin-user.mjs
 */
import "../server/lib/env.mjs";
import { bootstrapAdminUser } from "../server/lib/user-auth.mjs";

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
  console.error("用法: node scripts/create-admin-user.mjs <用户名> <新密码>");
  process.exit(1);
}

try {
  const user = bootstrapAdminUser(username, password);
  console.log(`✓ 管理员密码已重置: ${user.username} (id: ${user.id})`);
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}
