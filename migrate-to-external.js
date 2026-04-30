#!/usr/bin/env node
/**
 * Script para migrar imágenes base64 de la BD a un servicio externo
 * Soporta: Supabase, Cloudinary, imgbb
 * 
 * Uso:
 *   node migrate-to-external.js supabase
 *   node migrate-to-external.js cloudinary
 *   node migrate-to-external.js imgur
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

const SERVICE = process.argv[2] || 'supabase';

async function migrateToSupabase(imageData) {
  // TODO: Implementar con tu proyecto de Supabase
  // Necesitarás: @supabase/supabase-js
  throw new Error('Supabase migration not implemented yet. Set up manually or ask for code generation.');
}

async function migrateToCloudinary(imageData) {
  // Requiere: cloud_name y upload_preset en .env
  const axios = require('axios');
  const FormData = require('form-data');
  
  const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET;
  
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('CLOUDINARY env vars not set');
  }

  let base64String = imageData;
  if (base64String.startsWith('data:')) {
    base64String = base64String.split(',')[1];
  }

  const buffer = Buffer.from(base64String, 'base64');
  const formData = new FormData();
  formData.append('file', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
  formData.append('upload_preset', UPLOAD_PRESET);

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    formData,
    { headers: formData.getHeaders() }
  );

  return response.data.secure_url;
}

async function migrateToImgur(imageData) {
  // Requiere: api_key en .env
  const axios = require('axios');
  
  const API_KEY = process.env.IMGUR_API_KEY;
  if (!API_KEY) {
    throw new Error('IMGUR_API_KEY not set in .env');
  }

  let base64String = imageData;
  if (base64String.startsWith('data:')) {
    base64String = base64String.split(',')[1];
  }

  const response = await axios.post(
    'https://api.imgur.com/3/image',
    { image: base64String, type: 'base64' },
    { headers: { Authorization: `Client-ID ${API_KEY}` } }
  );

  return response.data.data.link;
}

async function migrate() {
  console.log(`\n🔄 Migrando imágenes a ${SERVICE.toUpperCase()}...\n`);

  const links = await prisma.link.findMany({
    where: { imageDataUrl: { not: null } }
  });

  console.log(`📊 Encontradas ${links.length} imágenes para migrar\n`);

  let successful = 0, failed = 0;

  for (const link of links) {
    try {
      console.log(`⏳ Migrando: "${link.title || 'Sin título'}"...`);

      let externalUrl;
      
      if (SERVICE === 'supabase') {
        externalUrl = await migrateToSupabase(link.imageDataUrl);
      } else if (SERVICE === 'cloudinary') {
        externalUrl = await migrateToCloudinary(link.imageDataUrl);
      } else if (SERVICE === 'imgur') {
        externalUrl = await migrateToImgur(link.imageDataUrl);
      } else {
        throw new Error(`Servicio desconocido: ${SERVICE}`);
      }

      await prisma.link.update({
        where: { id: link.id },
        data: {
          imageUrl: externalUrl,
          imageDataUrl: null,
          updatedAt: new Date()
        }
      });

      console.log(`   ✅ URL: ${externalUrl}\n`);
      successful++;
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
      failed++;
    }
  }

  console.log('\n📈 RESULTADO:');
  console.log(`   ✅ Exitosas: ${successful}`);
  console.log(`   ❌ Fallidas: ${failed}\n`);

  await prisma.$disconnect();
}

migrate().catch(console.error);
