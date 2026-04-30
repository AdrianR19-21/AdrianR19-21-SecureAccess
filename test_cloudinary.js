const fs = require('fs');

async function uploadToCloudinary() {
  try {
    const cloudName = 'aramirez1';
    const uploadPreset = 'Base_Datos';
    const filePath = './candado.png';

    // Leer el archivo local
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: 'image/png' });

    const formData = new FormData();
    formData.append('file', blob, 'candado.png');
    formData.append('upload_preset', uploadPreset);

    console.log('Subiendo a Cloudinary...');

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (response.ok) {
      console.log('¡Éxito! Aquí está la respuesta de Cloudinary:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.error('Error subiendo a Cloudinary:', data);
    }
  } catch (error) {
    console.error('Error general:', error);
  }
}

uploadToCloudinary();