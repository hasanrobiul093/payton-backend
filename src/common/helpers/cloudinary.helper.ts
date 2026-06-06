import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';

export const uploadImageToCloudinary = (
  fileBuffer: Buffer,
  folderName: string = 'profile_photos',
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Configure cloudinary (make sure these are set in your .env)
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: folderName },
      (error, result) => {
        if (error) return reject(error);
        if (!result)
          return reject(new Error('Cloudinary upload returned no result'));
        resolve(result.secure_url);
      },
    );

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};
