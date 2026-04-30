const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanLegacyImages() {
  console.log('\n🧹 LIMPIANDO IMÁGENES BASE64 DE LA BD...\n');

  // Obtener todos los links con imageDataUrl (base64)
  const linksWithBase64 = await prisma.link.findMany({
    where: {
      imageDataUrl: {
        not: null
      }
    },
    select: {
      id: true,
      title: true,
      imageDataUrl: true
    }
  });

  console.log(`📊 Encontradas ${linksWithBase64.length} imágenes para limpiar\n`);

  if (linksWithBase64.length === 0) {
    console.log('✅ No hay imágenes para limpiar');
    await prisma.$disconnect();
    return;
  }

  for (const link of linksWithBase64) {
    try {
      console.log(`🗑️  Limpiando: "${link.title || 'Sin título'}"...`);

      // Tamaño del base64
      const sizeMB = (link.imageDataUrl.length / (1024 * 1024)).toFixed(2);

      // Eliminar base64
      await prisma.link.update({
        where: { id: link.id },
        data: {
          imageDataUrl: null,
          updatedAt: new Date()
        }
      });

      console.log(`   ✅ Eliminado (${sizeMB} MB liberados)\n`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  }

  console.log('\n✨ LIMPIEZA COMPLETADA');
  console.log('   Las nuevas imágenes que subes irán a Cloudinary (servidores externos)');
  console.log('   Las imágenes antiguas han sido eliminadas de tu PC\n');

  await prisma.$disconnect();
}

cleanLegacyImages().catch(console.error);
