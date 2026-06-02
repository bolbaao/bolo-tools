#!/usr/bin/env node
import "../server/lib/env.mjs";
import { bootstrapAdminUser } from "../server/lib/user-auth.mjs";

const username = process.argv[2] || "bolo";
const password = process.argv[3] || "123456";

try {
  const user = bootstrapAdminUser(username, password);
  console.log(`✓ 管理员账号已就绪: ${user.username} (id: ${user.id})`);
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}
