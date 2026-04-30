import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

    if (cloudName && uploadPreset) {
      // Intentar subir a Cloudinary
      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

      const cloudinaryFormData = new FormData();
      cloudinaryFormData.append('file', file);
      cloudinaryFormData.append('upload_preset', uploadPreset);

      const cloudinaryResponse = await fetch(cloudinaryUrl, {
        method: 'POST',
        body: cloudinaryFormData,
      });

      if (cloudinaryResponse.ok) {
        const data = await cloudinaryResponse.json();
        return NextResponse.json({
          imageUrl: data.secure_url,
          success: true
        });
      } else {
        console.warn('Cloudinary upload failed, falling back...');
      }
    }

    // Fallback original: Convertir archivo a base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    const mimeType = file.type || 'image/jpeg';
    const imageDataUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({
      imageUrl: imageDataUrl,
      success: true
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
