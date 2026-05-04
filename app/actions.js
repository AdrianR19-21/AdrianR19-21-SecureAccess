'use server';

import crypto, { publicDecrypt } from 'crypto';
import { prisma, ensureDatabaseReady } from '../lib/prisma';
import { revalidatePath } from 'next/cache';

const PASSWORD_PREFIX = 'scrypt$';
const VAULT_PREFIX = 'enc:v1:';
const VAULT_KEY = crypto
  .createHash('sha256')
  .update(process.env.VAULT_ENCRYPTION_KEY || 'antigravity-vault-dev-key')
  .digest();
let passwordMigrationPromise = null;

function safeEqual(a, b) {
  const left = Buffer.from((a ?? '').toString(), 'utf8');
  const right = Buffer.from((b ?? '').toString(), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `${PASSWORD_PREFIX}${salt.toString('hex')}$${derived.toString('hex')}`;
}

function isPasswordHash(value) {
  return typeof value === 'string' && value.startsWith(PASSWORD_PREFIX);
}

function verifyPassword(provided, stored) {
  if (!stored) return false;

  if (!isPasswordHash(stored)) {
    return safeEqual(provided, stored);
  }

  const [, saltHex, hashHex] = stored.split('$');
  if (!saltHex || !hashHex) return false;

  try {
    const derived = crypto.scryptSync(provided, Buffer.from(saltHex, 'hex'), 64);
    const expected = Buffer.from(hashHex, 'hex');
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function encryptVaultValue(value) {
  const text = (value ?? '').toString();
  if (!text) return '';

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', VAULT_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VAULT_PREFIX,
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

function decryptVaultValue(value) {
  const text = (value ?? '').toString();
  if (!text) return '';
  if (!text.startsWith(VAULT_PREFIX)) return text;

  const [, ivHex, authTagHex, encryptedHex] = text.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) return text;

  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      VAULT_KEY,
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return text;
  }
}

async function migrateLegacyPasswords() {
  const legacyUsers = await prisma.user.findMany({
    where: {
      NOT: {
        password: {
          startsWith: PASSWORD_PREFIX,
        },
      },
    },
    select: {
      id: true,
      password: true,
    },
  });

  if (!legacyUsers.length) return;

  await prisma.$transaction(
    legacyUsers.map((user) =>
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashPassword(user.password) },
      })
    )
  );
}

async function ensureLegacyPasswordMigration() {
  await ensureDatabaseReady();

  if (!passwordMigrationPromise) {
    passwordMigrationPromise = migrateLegacyPasswords().catch((error) => {
      passwordMigrationPromise = null;
      throw error;
    });
  }

  return passwordMigrationPromise;
}

export async function getUser(username, password) {
  await ensureDatabaseReady();
  await ensureLegacyPasswordMigration();

  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (user && verifyPassword(password, user.password)) {
    if (!isPasswordHash(user.password)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashPassword(password) },
      });
    }

    return { id: user.id, username: user.username };
  }
  return null;
}

export async function registerUser(username, password) {
  await ensureDatabaseReady();
  await ensureLegacyPasswordMigration();

  const existing = await prisma.user.findUnique({
    where: { username },
  });

  if (existing) {
    throw new Error('El usuario ya existe');
  }

  const user = await prisma.user.create({
    data: { username, password: hashPassword(password) },
  });

  return { id: user.id, username: user.username };
}

export async function getUserData(userId) {
  await ensureDatabaseReady();
  const uid = parseInt(userId);
  const links = await prisma.link.findMany({
    where: { userId: uid },
    orderBy: { createdAt: 'desc' },
  });

  const vault = await prisma.vaultEntry.findMany({
    where: { userId: uid },
    orderBy: { createdAt: 'desc' },
  });

  return {
    links,
    vault: vault.map((entry) => ({
      ...entry,
      secretValue: decryptVaultValue(entry.secretValue),
    })),
  };
}

async function getOwnedLink(id, userId) {
  return prisma.link.findFirst({
    where: { id, userId: parseInt(userId) },
  });
}

async function getOwnedVaultEntry(id, userId) {
  return prisma.vaultEntry.findFirst({
    where: { id, userId: parseInt(userId) },
  });
}

export async function saveLinkAction(data, userId) {
  await ensureDatabaseReady();
  const uid = parseInt(userId);
  const payload = {
    title: data.title,
    url: data.url,
    notes: data.notes,
    keywords: data.keywords,
  };

  if (data.imageDataUrl !== undefined) {
    payload.imageDataUrl = data.imageDataUrl;
  }

  if (data.imageUrl !== undefined) {
    payload.imageUrl = data.imageUrl;
  }

  if (data.id) {
    const existingLink = await getOwnedLink(data.id, uid);

    if (!existingLink) {
      throw new Error('Enlace no encontrado');
    }

    return prisma.link.update({
      where: { id: data.id },
      data: payload,
    });
  } else {
    return prisma.link.create({
      data: {
        ...payload,
        imageDataUrl: data.imageDataUrl ?? null,
        imageUrl: data.imageUrl ?? null,
        userId: uid,
      },
    });
  }
}

export async function deleteLinkAction(id, userId) {
  await ensureDatabaseReady();
  const uid = parseInt(userId);
  if (isNaN(uid)) throw new Error('ID de usuario no válido');

  const existing = await prisma.link.findFirst({
    where: { id, userId: uid }
  });

  if (!existing) throw new Error('No tienes permiso o el enlace no existe');

  await prisma.link.delete({
    where: { id },
  });
  
  revalidatePath('/');
  return { success: true };
}

export async function removeLinkImageAction(id, userId) {
  await ensureDatabaseReady();
  const uid = parseInt(userId);
  if (isNaN(uid)) throw new Error('ID de usuario no válido');

  const existingLink = await getOwnedLink(id, uid);

  if (!existingLink) {
    throw new Error('Enlace no encontrado');
  }

  const updated = await prisma.link.update({
    where: { id },
    data: {
      imageDataUrl: null,
      imageUrl: null,
      updatedAt: new Date(),
    },
  });

  revalidatePath('/');
  return updated;
}

export async function saveVaultAction(data, userId) {
  await ensureDatabaseReady();
  const uid = parseInt(userId);
  const encryptedSecretValue = encryptVaultValue(data.secretValue);

  if (data.id) {
    const existingVaultEntry = await getOwnedVaultEntry(data.id, uid);

    if (!existingVaultEntry) {
      throw new Error('Credencial no encontrada');
    }

    return prisma.vaultEntry.update({
      where: { id: data.id },
      data: {
        title: data.title,
        siteUrl: data.siteUrl,
        loginName: data.loginName,
        secretValue: encryptedSecretValue,
        notes: data.notes,
      },
    });
  } else {
    return prisma.vaultEntry.create({
      data: {
        title: data.title,
        siteUrl: data.siteUrl,
        loginName: data.loginName,
        secretValue: encryptedSecretValue,
        notes: data.notes,
        userId: uid,
      },
    });
  }
}

export async function deleteVaultAction(id, userId) {
  await ensureDatabaseReady();
  const uid = parseInt(userId);
  if (isNaN(uid)) throw new Error('ID de usuario no válido');

  const existing = await prisma.vaultEntry.findFirst({
    where: { id, userId: uid }
  });

  if (!existing) throw new Error('No tienes permiso o la credencial no existe');

  await prisma.vaultEntry.delete({
    where: { id },
  });

  revalidatePath('/');
  return { success: true };
}

