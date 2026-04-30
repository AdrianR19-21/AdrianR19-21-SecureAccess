const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const prisma = new PrismaClient();

// Cargar variables del .env
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, value] = line.split('=');
    if (key && value) {
      envVars[key.trim()] = value.trim();
    }
  }
});

const CLOUDINARY_CLOUD_NAME = envVars.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = envVars.CLOUDINARY_UPLOAD_PRESET;

async function uploadBase64ToCloudinary(base64Data) {
  try {
    // Extraer base64 limpio
    let base64String = base64Data;
    if (base64String.startsWith('data:')) {
      base64String = base64String.split(',')[1];
    }

    // Convertir a buffer
    const buffer = Buffer.from(base64String, 'base64');
    
    // Crear FormData
    const formData = new FormData();
    formData.append('file', buffer, { 
      filename: 'image.jpg',
      contentType: 'image/jpeg'
    });
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    // Upload con axios
    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      formData,
      {
        headers: formData.getHeaders(),
      }
    );

    return response.data.secure_url;
  } catch (error) {
    throw new Error(`Cloudinary error: ${error.response?.data?.error?.message || error.message}`);
  }
}

async function migrateImagesToExternal() {
  console.log('\n🔄 INICIANDO MIGRACIÓN DE IMÁGENES A CLOUDINARY...\n');
  console.log(`📋 Configuración:`);
  console.log(`   Cloud Name: ${CLOUDINARY_CLOUD_NAME}`);
  console.log(`   Upload Preset: ${CLOUDINARY_UPLOAD_PRESET}\n`);

  // Obtener todos los links con imageDataUrl (base64)
  const linksWithBase64 = await prisma.link.findMany({
    where: {
      imageDataUrl: {
        not: null
      }
    }
  });

  console.log(`📊 Encontradas ${linksWithBase64.length} imágenes para migrar\n`);

  if (linksWithBase64.length === 0) {
    console.log('✅ No hay imágenes para migrar');
    await prisma.$disconnect();
    return;
  }

  let successful = 0;
  let failed = 0;

  for (const link of linksWithBase64) {
    try {
      console.log(`⏳ Migrando: "${link.title || 'Sin título'}"...`);

      // Subir a Cloudinary
      const externalUrl = await uploadBase64ToCloudinary(link.imageDataUrl);

      // Actualizar BD
      await prisma.link.update({
        where: { id: link.id },
        data: {
          imageUrl: externalUrl,
          imageDataUrl: null, // Limpiar el base64 antiguo
          updatedAt: new Date()
        }
      });

      console.log(`   ✅ Guardada en: ${externalUrl}\n`);
      successful++;
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
      failed++;
    }
  }

  console.log('\n📈 RESULTADO DE LA MIGRACIÓN:');
  console.log(`   ✅ Exitosas: ${successful}`);
  console.log(`   ❌ Fallidas: ${failed}`);
  console.log(`   📊 Total procesadas: ${successful + failed}\n`);

  await prisma.$disconnect();
}

migrateImagesToExternal().catch(console.error);
