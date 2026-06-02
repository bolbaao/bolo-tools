import { listAllUsers, toPublicUser } from "./user-auth.mjs";
import { listUserMemories } from "./user-memory.mjs";

export function listUsersWithStats() {
  return listAllUsers().map((user) => {
    const memories = listUserMemories(user.id);
    return {
      ...toPublicUser(user),
      createdAt: user.createdAt,
      memoryCount: memories.length,
    };
  });
}

export function getUserArchive(userId) {
  const user = listAllUsers().find((u) => u.id === userId);
  if (!user) throw Object.assign(new Error("用户不存在"), { status: 404 });

  return {
    user: { ...toPublicUser(user), createdAt: user.createdAt },
    memories: listUserMemories(userId),
  };
}
