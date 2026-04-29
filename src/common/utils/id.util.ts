import { customAlphabet } from 'nanoid';

// URL-safe alphabet, 10 chars → ~1 trillion combinations
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);

export const generateId = {
  user: (): string => `usr_${nanoid()}`,
  room: (): string => `room_${nanoid()}`,
  message: (): string => `msg_${nanoid()}`,
  session: (): string => `sess_${nanoid()}${nanoid()}`, // 20-char opaque token
};
