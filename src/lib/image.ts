/**
 * Shrinks a photo in the browser to a JPEG no larger than `maxSide` pixels,
 * so uploads and receipt parsing stay fast on mobile data.
 */
export async function downscale(
  file: Blob,
  maxSide = 1600,
): Promise<{ blob: Blob; base64: string; previewUrl: string }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that photo"))), "image/jpeg", 0.82),
  );
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  return { blob, base64: dataUrl.slice(dataUrl.indexOf(",") + 1), previewUrl: URL.createObjectURL(blob) };
}
