import { listAllUsers, toPublicUser } from "./user-auth.mjs";
import { listUserMemories } from "./user-memory.mjs";
import { getChatSession, listChatSessions } from "./user-chat-history.mjs";

export function listUsersWithStats() {
  return listAllUsers().map((user) => {
    const memories = listUserMemories(user.id);
    const sessions = listChatSessions(user.id);
    return {
      ...toPublicUser(user),
      createdAt: user.createdAt,
      memoryCount: memories.length,
      chatSessionCount: sessions.length,
    };
  });
}

export function getUserArchive(userId) {
  const user = listAllUsers().find((u) => u.id === userId);
  if (!user) throw Object.assign(new Error("用户不存在"), { status: 404 });

  return {
    user: { ...toPublicUser(user), createdAt: user.createdAt },
    memories: listUserMemories(userId),
    chatSessions: listChatSessions(userId),
  };
}

export function getUserChatSession(userId, sessionId) {
  const user = listAllUsers().find((u) => u.id === userId);
  if (!user) throw Object.assign(new Error("用户不存在"), { status: 404 });
  return getChatSession(userId, sessionId);
}
