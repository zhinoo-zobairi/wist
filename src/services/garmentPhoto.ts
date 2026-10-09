import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";

export async function prepareGarmentPhoto(asset: ImagePickerAsset): Promise<string> {
  const context = ImageManipulator.manipulate(asset.uri);
  try {
    if (Math.max(asset.width, asset.height) > 1568) {
      context.resize(asset.width >= asset.height ? { width: 1568 } : { height: 1568 });
    }
    const image = await context.renderAsync();
    try {
      return (await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 })).uri;
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}
