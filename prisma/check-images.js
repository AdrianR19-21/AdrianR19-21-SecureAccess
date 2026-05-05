const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkImages() {
  const links = await prisma.link.findMany({
    select: {
      title: true,
      imageUrl: true,
      imageDataUrl: true
    }
  });

  console.log('\n=== IMÁGENES GUARDADAS EN SERVIDORES EXTERNOS ===\n');
  
  links.forEach((link, index) => {
    console.log(`${index + 1}. ${link.title || 'Sin título'}`);
    
    if (link.imageUrl) {
      console.log('   📍 URL EXTERNA (imgbb):');
      console.log(`   ${link.imageUrl}`);
    }
m
    if (link.imageDataUrl) {
      console.log('   📦 Base64 (legacy - no usar):');
      console.log(`   ${link.imageDataUrl.substring(0, 100)}...`);
    }
    
    if (!link.imageUrl && !link.imageDataUrl) {
      console.log('   ❌ Sin imagen');
    }
    
    console.log('');
  });

  await prisma.$disconnect();
}

checkImages().catch(console.error);

